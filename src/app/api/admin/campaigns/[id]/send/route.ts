export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { resolveSegment, renderTemplate, instrumentEmailHtml, type SegmentFilters } from '@/lib/marketing';
import { sendMarketingEmail, getBaseUrl } from '@/lib/marketing-mailer';

// Sleep helper for rate-limiting between sends.
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function ensureMarketingToken(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { marketingToken: true } });
  if (u?.marketingToken) return u.marketingToken;
  const token = randomBytes(24).toString('hex');
  await prisma.user.update({ where: { id: userId }, data: { marketingToken: token } });
  return token;
}

// POST /api/admin/campaigns/[id]/send — fire-and-forget background sender.
// Super-admin only — campaign sends cost real money (per-recipient SMTP)
// and brand reputation; the staff write perm is intentionally not enough.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('response' in guard) return guard.response;
  const auth = guard.user;
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 });
  if (campaign.status === 'sending') {
    return NextResponse.json({ error: 'الحملة قيد الإرسال بالفعل' }, { status: 400 });
  }

  // Resolve recipients again at send time so the audience is fresh.
  const filters = (campaign.segmentFilters as SegmentFilters | null) || {};
  const matches = await resolveSegment(campaign.segmentKey, filters);
  const reachable = matches.filter(m => m.marketingOptIn && m.email);

  if (reachable.length === 0) {
    return NextResponse.json({ error: 'لا يوجد مستلمون قابلون للوصول' }, { status: 400 });
  }

  // Mark as sending and create recipient rows up-front (idempotent via @@unique).
  await prisma.campaign.update({
    where: { id },
    data: {
      status: 'sending',
      startedAt: new Date(),
      recipientCount: reachable.length,
      sentCount: 0,
      openedCount: 0,
      clickedCount: 0,
    },
  });
  for (const r of reachable) {
    await prisma.campaignRecipient.upsert({
      where: { campaignId_userId: { campaignId: id, userId: r.userId } },
      create: { campaignId: id, userId: r.userId, email: r.email, status: 'queued' },
      update: { email: r.email, status: 'queued', errorMessage: null },
    });
  }

  // Fire-and-forget loop. We rely on PM2 fork mode keeping the process alive.
  void runSend(id);

  await logActionSafe({
    actor: auth,
    action: 'campaign.send',
    entity: 'Campaign',
    entityId: campaign.id,
    metadata: { name: campaign.name, queued: reachable.length },
  });

  return NextResponse.json({ ok: true, queued: reachable.length });
}

// Exported so /resume can pick up a campaign whose process died mid-run.
export const resumeCampaignSend = (campaignId: string) => runSend(campaignId);

async function runSend(campaignId: string) {
  const baseUrl = getBaseUrl();
  let sent = 0;
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
        const renderedBody = renderTemplate(campaign.bodyHtml, {
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
        sent += 1;
        await prisma.campaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        await prisma.campaignRecipient.update({
          where: { id: r.id },
          data: { status: 'failed', errorMessage: message.slice(0, 500) },
        });
        failed += 1;
      }
      // ~30/min throttle for Titan SMTP
      await sleep(2000);
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: failed === recipients.length ? 'failed' : 'sent', finishedAt: new Date() },
    });
  } catch (err) {
    console.error('[campaign send loop]', err);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'failed', finishedAt: new Date() },
    });
  }
}
