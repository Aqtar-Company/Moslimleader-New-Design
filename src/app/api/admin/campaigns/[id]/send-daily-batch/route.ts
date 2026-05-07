export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { resolveSegment, renderTemplate, instrumentEmailHtml, type SegmentFilters } from '@/lib/marketing';
import { sendMarketingEmail, getBaseUrl } from '@/lib/marketing-mailer';
import { renderPlainTextEmail } from '@/lib/email-template';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function ensureMarketingToken(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { marketingToken: true } });
  if (u?.marketingToken) return u.marketingToken;
  const token = randomBytes(24).toString('hex');
  await prisma.user.update({ where: { id: userId }, data: { marketingToken: token } });
  return token;
}

// POST /api/admin/campaigns/[id]/send-daily-batch — send a small daily
// drip (default 5 recipients) instead of a one-shot blast. The assistant
// clicks this once a day so the inbox doesn't look algorithmic. Same
// super-admin gate as /send because the action still consumes SMTP and
// affects sender reputation.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('response' in guard) return guard.response;
  const auth = guard.user;
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 });

  const limit = Math.max(1, Math.min(50, campaign.dailyLimit ?? 5));

  // 1) Refresh recipient pool from the segment so newly-eligible customers
  //    can receive future drips. Idempotent via @@unique on (campaignId, userId).
  const filters = (campaign.segmentFilters as SegmentFilters | null) || {};
  const matches = await resolveSegment(campaign.segmentKey, filters);
  const reachable = matches.filter(m => m.marketingOptIn && m.email);
  for (const r of reachable) {
    await prisma.campaignRecipient.upsert({
      where: { campaignId_userId: { campaignId: id, userId: r.userId } },
      create: { campaignId: id, userId: r.userId, email: r.email, status: 'queued' },
      update: {}, // never overwrite a sent/failed row
    });
  }

  // Mark sending if it's the first drip.
  if (campaign.status === 'draft') {
    await prisma.campaign.update({
      where: { id },
      data: {
        status: 'sending',
        startedAt: campaign.startedAt ?? new Date(),
        recipientCount: reachable.length,
      },
    });
  }

  // 2) Pick the next batch of queued recipients.
  const batch = await prisma.campaignRecipient.findMany({
    where: { campaignId: id, status: 'queued' },
    include: { user: { select: { id: true, name: true } } },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  if (batch.length === 0) {
    // Nothing left to send — finalise the campaign.
    await prisma.campaign.update({
      where: { id },
      data: { status: 'sent', finishedAt: new Date(), lastBatchAt: new Date() },
    });
    return NextResponse.json({ ok: true, sent: 0, queuedRemaining: 0, finished: true });
  }

  // 3) Send inline (small batch — fast enough not to fire-and-forget).
  const baseUrl = getBaseUrl();
  let sent = 0;
  let failed = 0;

  for (const r of batch) {
    try {
      const token = await ensureMarketingToken(r.userId);
      const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${token}`;
      const firstName = (r.user.name || '').split(/\s+/)[0] || r.user.name || '';

      // Prefer the new bodyText path; fall back to legacy bodyHtml.
      const bodyHtmlRaw = campaign.bodyText
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
      const finalHtml = instrumentEmailHtml(bodyHtmlRaw, id, r.id, baseUrl, unsubscribeUrl);

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
      await prisma.campaign.update({
        where: { id },
        data: { sentCount: { increment: 1 } },
      });
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      await prisma.campaignRecipient.update({
        where: { id: r.id },
        data: { status: 'failed', errorMessage: message.slice(0, 500) },
      });
      failed++;
    }
    // 2s/email pacing — same as the legacy blast loop, well under Titan's limit.
    await sleep(2000);
  }

  // 4) Update the campaign + finalise if drained.
  const remaining = await prisma.campaignRecipient.count({
    where: { campaignId: id, status: 'queued' },
  });
  await prisma.campaign.update({
    where: { id },
    data: {
      lastBatchAt: new Date(),
      ...(remaining === 0 ? { status: 'sent', finishedAt: new Date() } : {}),
    },
  });

  await logActionSafe({
    actor: auth,
    action: 'campaign.send',
    entity: 'Campaign',
    entityId: id,
    metadata: { kind: 'daily-batch', sent, failed, remaining, dailyLimit: limit },
  });

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    queuedRemaining: remaining,
    finished: remaining === 0,
  });
}
