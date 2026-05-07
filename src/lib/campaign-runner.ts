// Background sender for marketing campaigns, extracted from the /send
// route. Lives in `lib/` rather than the route file because Next.js 14's
// route module type-checker flags non-handler exports on a `route.ts`
// file (the `resumeCampaignSend` re-export was the type error fixed by
// Plan Addendum 9 #1).
//
// Both /send and /resume import `runSend` from here. The function is
// fire-and-forget: each call awaits inside a void wrapper so the HTTP
// request returns immediately while sending continues on the PM2 fork.
import { randomBytes } from 'crypto';
import { prisma } from './prisma';
import { resolveSegment, renderTemplate, instrumentEmailHtml, type SegmentFilters } from './marketing';
import { sendMarketingEmail, getBaseUrl } from './marketing-mailer';
import { renderPlainTextEmail } from './email-template';

// Sleep helper for Titan SMTP throttle (~30/min).
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Lazily mint a per-user marketing token used in unsubscribe links.
// Idempotent — caches into the user row so the same token is reused
// across campaigns (and across one-click unsubscribe links).
export async function ensureMarketingToken(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { marketingToken: true } });
  if (u?.marketingToken) return u.marketingToken;
  const token = randomBytes(24).toString('hex');
  await prisma.user.update({ where: { id: userId }, data: { marketingToken: token } });
  return token;
}

// Fire the queued recipients of a campaign one by one. Throttles ~30/min
// for Titan SMTP, marks each row sent/failed, and finalises the campaign
// status to `sent` or `failed` (failed only if every send failed).
//
// Used in two places:
//   - POST /send → kicks off after creating queued rows.
//   - POST /resume → picks up where a crashed PM2 process left off.
export async function runSend(campaignId: string): Promise<void> {
  const baseUrl = getBaseUrl();
  let failed = 0;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;

    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId, status: 'queued' },
      include: { user: { select: { id: true, name: true } } },
    });

    for (const r of recipients) {
      try {
        const token = await ensureMarketingToken(r.userId);
        const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${token}`;
        const firstName = (r.user.name || '').split(/\s+/)[0] || r.user.name || '';
        // Prefer the new plain-text path (bodyText → branded email).
        // Legacy campaigns (bodyText null) keep using the old template.
        const renderedBody = campaign.bodyText
          ? renderPlainTextEmail({
              bodyText: campaign.bodyText,
              firstName,
              couponCode: campaign.couponCode,
              ctaLabel: campaign.ctaLabel,
              ctaUrl: campaign.ctaUrl,
            })
          : renderTemplate(campaign.bodyHtml, {
              name: r.user.name || '',
              firstName,
              email: r.email,
              couponCode: campaign.couponCode || undefined,
              unsubscribeUrl,
            });
        const renderedSubject = renderTemplate(campaign.subject, {
          name: r.user.name || '',
          firstName,
          email: r.email,
          couponCode: campaign.couponCode || undefined,
          unsubscribeUrl,
        });
        const finalHtml = instrumentEmailHtml(renderedBody, campaignId, r.id, baseUrl, unsubscribeUrl);

        await sendMarketingEmail({
          to: r.email,
          subject: renderedSubject,
          html: finalHtml,
          unsubscribeUrl,
        });
        await prisma.campaignRecipient.update({
          where: { id: r.id },
          data: { status: 'sent', sentAt: new Date() },
        });
        await prisma.campaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        await prisma.campaignRecipient.update({
          where: { id: r.id },
          data: { status: 'failed', errorMessage: message.slice(0, 500) },
        });
        failed += 1;
      }
      await sleep(2000);
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: failed === recipients.length && recipients.length > 0 ? 'failed' : 'sent', finishedAt: new Date() },
    });
  } catch (err) {
    console.error('[campaign send loop]', err);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'failed', finishedAt: new Date() },
    });
  }
}

// Re-export under the legacy name so /resume reads naturally.
export const resumeCampaignSend = (campaignId: string): Promise<void> => runSend(campaignId);

// Used to type the SegmentFilters from /send when re-resolving recipients.
export type { SegmentFilters };
