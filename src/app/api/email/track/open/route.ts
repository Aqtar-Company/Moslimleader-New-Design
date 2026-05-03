export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 1×1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cid = url.searchParams.get('cid');
  const rid = url.searchParams.get('rid');

  // Always return the pixel — never block on DB.
  const response = new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Length': String(PIXEL.length),
    },
  });

  if (cid && rid) {
    // Fire-and-forget DB update.
    void (async () => {
      try {
        const recipient = await prisma.campaignRecipient.findUnique({ where: { id: rid } });
        if (!recipient || recipient.campaignId !== cid) return;
        if (!recipient.openedAt) {
          await prisma.campaignRecipient.update({ where: { id: rid }, data: { openedAt: new Date() } });
          await prisma.campaign.update({ where: { id: cid }, data: { openedCount: { increment: 1 } } });
        }
      } catch (err) {
        console.error('[email open track]', err);
      }
    })();
  }
  return response;
}
