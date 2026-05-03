export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTrackingSig } from '@/lib/marketing-sign';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

const pixelResponse = () => new NextResponse(PIXEL, {
  status: 200,
  headers: {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Length': String(PIXEL.length),
  },
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cid = url.searchParams.get('cid');
  const rid = url.searchParams.get('rid');
  const sig = url.searchParams.get('s');

  // Always return the pixel so the email looks normal even on bad sigs.
  const response = pixelResponse();
  if (!cid || !rid || !verifyTrackingSig({ cid, rid, kind: 'open' }, sig)) {
    return response;
  }

  void (async () => {
    try {
      // Conditional update to avoid the read-then-update race that double-counts.
      const updated = await prisma.campaignRecipient.updateMany({
        where: { id: rid, campaignId: cid, openedAt: null },
        data: { openedAt: new Date() },
      });
      if (updated.count === 1) {
        await prisma.campaign.update({ where: { id: cid }, data: { openedCount: { increment: 1 } } });
      }
    } catch (err) {
      console.error('[email open track]', err);
    }
  })();

  return response;
}
