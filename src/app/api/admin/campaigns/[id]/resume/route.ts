export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { resumeCampaignSend } from '../send/route';

// POST /api/admin/campaigns/[id]/resume — pick up a campaign that was stuck in
// `sending` (e.g. PM2 restarted mid-run) and continue with whatever recipients
// are still `queued`.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
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
  void resumeCampaignSend(id);
  return NextResponse.json({ ok: true, queued });
}
