export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTrackingSig } from '@/lib/marketing-sign';

const fallback = () =>
  (process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com').replace(/\/+$/, '');

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cid = url.searchParams.get('cid');
  const rid = url.searchParams.get('rid');
  const target = url.searchParams.get('u');
  const sig = url.searchParams.get('s');

  // Validate signature before honouring the redirect — kills the open-redirect risk.
  if (!cid || !rid || !target || !verifyTrackingSig({ cid, rid, kind: 'click', u: target }, sig)) {
    return NextResponse.redirect(fallback(), 302);
  }

  let safeTarget = fallback();
  try {
    const parsed = new URL(target);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      safeTarget = parsed.toString();
    }
  } catch {
    // keep fallback
  }

  void (async () => {
    try {
      // Conditional updates avoid double-counting on Gmail prefetch + user click.
      const openedNow = await prisma.campaignRecipient.updateMany({
        where: { id: rid, campaignId: cid, openedAt: null },
        data: { openedAt: new Date() },
      });
      const clickedNow = await prisma.campaignRecipient.updateMany({
        where: { id: rid, campaignId: cid, clickedAt: null },
        data: { clickedAt: new Date() },
      });
      const incr: Record<string, { increment: number }> = {};
      if (openedNow.count === 1) incr.openedCount = { increment: 1 };
      if (clickedNow.count === 1) incr.clickedCount = { increment: 1 };
      if (Object.keys(incr).length > 0) {
        await prisma.campaign.update({ where: { id: cid }, data: incr });
      }
    } catch (err) {
      console.error('[email click track]', err);
    }
  })();

  return NextResponse.redirect(safeTarget, 302);
}
