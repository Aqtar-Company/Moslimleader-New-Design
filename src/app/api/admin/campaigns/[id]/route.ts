export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm(['campaigns.read', 'campaigns.write'] as Permission[]);
  if ('response' in guard) return guard.response;

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      recipients: {
        select: {
          id: true, email: true, status: true, sentAt: true,
          openedAt: true, clickedAt: true, errorMessage: true,
          user: { select: { id: true, name: true } },
        },
        // Order by status so queued rows appear first in the truncated slice;
        // sent ones still listed via secondary createdAt sort. Without this
        // big campaigns (>200 recipients) hide every queued row behind sent
        // ones and the detail page falsely renders "خلص الجمهور".
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 200,
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 });
  // Server-computed counters so the UI doesn't infer them from the truncated
  // recipients array (which would lie for any campaign > 200 recipients).
  const [queuedCount, sentCount, failedCount] = await Promise.all([
    prisma.campaignRecipient.count({ where: { campaignId: id, status: 'queued' } }),
    prisma.campaignRecipient.count({ where: { campaignId: id, status: 'sent' } }),
    prisma.campaignRecipient.count({ where: { campaignId: id, status: 'failed' } }),
  ]);
  return NextResponse.json({
    campaign,
    counts: { queued: queuedCount, sent: sentCount, failed: failedCount },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('campaigns.write');
  if ('response' in guard) return guard.response;
  const auth = guard.user;

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 });
  if (campaign.status === 'sending') {
    return NextResponse.json({ error: 'لا يمكن حذف حملة قيد الإرسال' }, { status: 400 });
  }
  await prisma.campaign.delete({ where: { id } });
  await logActionSafe({
    actor: auth,
    action: 'campaign.update',
    entity: 'Campaign',
    entityId: id,
    metadata: { kind: 'delete', name: campaign.name },
  });
  return NextResponse.json({ ok: true });
}
