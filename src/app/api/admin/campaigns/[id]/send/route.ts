export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { resolveSegment, type SegmentFilters } from '@/lib/marketing';
import { runSend } from '@/lib/campaign-runner';

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
