export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resumeCampaignSend } from '@/lib/campaign-runner';
import { requireSuperAdmin } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// POST /api/admin/campaigns/[id]/resume — pick up a campaign that was stuck in
// `sending` (e.g. PM2 restarted mid-run) and continue with whatever recipients
// are still `queued`. Super-admin only (same rationale as /send).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('response' in guard) return guard.response;
  const auth = guard.user;
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 });
  if (campaign.status !== 'sending' && campaign.status !== 'failed') {
    return NextResponse.json({ error: 'لا يمكن استئناف حملة بهذه الحالة' }, { status: 400 });
  }
  const queued = await prisma.campaignRecipient.count({
    where: { campaignId: id, status: 'queued' },
  });
  if (queued === 0) {
    await prisma.campaign.update({ where: { id }, data: { status: 'sent', finishedAt: new Date() } });
    return NextResponse.json({ ok: true, queued: 0 });
  }
  await prisma.campaign.update({ where: { id }, data: { status: 'sending' } });
  await logActionSafe({
    actor: auth,
    action: 'campaign.send',
    entity: 'Campaign',
    entityId: id,
    metadata: { kind: 'resume', queued, name: campaign.name },
  });
  void resumeCampaignSend(id);
  return NextResponse.json({ ok: true, queued });
}
