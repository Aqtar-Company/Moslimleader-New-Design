export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cid = url.searchParams.get('cid');
  const rid = url.searchParams.get('rid');
  const target = url.searchParams.get('u');

  const safeTarget = (() => {
    if (!target) return process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';
    try {
      const parsed = new URL(target);
      // Only allow http/https targets — guard against javascript: etc.
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';
      }
      return parsed.toString();
    } catch {
      return process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';
    }
  })();

  if (cid && rid) {
    void (async () => {
      try {
        const recipient = await prisma.campaignRecipient.findUnique({ where: { id: rid } });
        if (!recipient || recipient.campaignId !== cid) return;
        const now = new Date();
        if (!recipient.openedAt) {
          await prisma.campaign.update({ where: { id: cid }, data: { openedCount: { increment: 1 } } });
        }
        if (!recipient.clickedAt) {
          await prisma.campaign.update({ where: { id: cid }, data: { clickedCount: { increment: 1 } } });
        }
        await prisma.campaignRecipient.update({
          where: { id: rid },
          data: {
            openedAt: recipient.openedAt || now,
            clickedAt: recipient.clickedAt || now,
          },
        });
      } catch (err) {
        console.error('[email click track]', err);
      }
    })();
  }
  return NextResponse.redirect(safeTarget, 302);
}
