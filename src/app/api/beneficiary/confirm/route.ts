export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_MESSAGES_PER_COPY = 3;
const MAX_MEDIA_PER_COPY = 3;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // F-05: rate limit — max 10 confirmations per user per hour
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { allowed } = checkRateLimit(`beneficiary-confirm:${user.userId}:${ip}`, 10, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = await req.json();
  const { copyId, message, mediaUrl } = body as { copyId: string; message?: string; mediaUrl?: string };

  if (!copyId) return NextResponse.json({ error: 'copyId required' }, { status: 400 });

  // F-13: server-side length limits
  if (message && message.length > 1000) return NextResponse.json({ error: 'message_too_long' }, { status: 400 });

  // F-07: validate mediaUrl — must be https:// to prevent javascript: URIs and SSRF
  if (mediaUrl) {
    try {
      const parsed = new URL(mediaUrl);
      if (parsed.protocol !== 'https:') throw new Error();
    } catch {
      return NextResponse.json({ error: 'invalid_media_url' }, { status: 400 });
    }
  }

  const copy = await prisma.sponsoredCopy.findUnique({
    where: { id: copyId },
    select: { id: true, status: true, beneficiaryUserId: true },
  });

  if (!copy) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (copy.beneficiaryUserId !== user.userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!['DELIVERED', 'CONFIRMED'].includes(copy.status)) {
    return NextResponse.json({ error: 'copy_not_delivered' }, { status: 400 });
  }

  await prisma.$transaction(async tx => {
    if (copy.status === 'DELIVERED') {
      await tx.sponsoredCopy.update({
        where: { id: copyId },
        data: { status: 'CONFIRMED', beneficiaryConfirmedAt: new Date() },
      });
      await tx.sponsoredCopyEvent.create({
        data: { copyId, event: 'BENEFICIARY_CONFIRMED' },
      });
    }

    if (message?.trim()) {
      // F-08: cap messages per copy to prevent moderation queue flooding
      const msgCount = await tx.beneficiaryImpactMessage.count({ where: { copyId } });
      if (msgCount < MAX_MESSAGES_PER_COPY) {
        await tx.beneficiaryImpactMessage.create({
          data: { copyId, beneficiaryUserId: user.userId, message: message.trim(), status: 'PENDING_REVIEW' },
        });
        await tx.sponsoredCopyEvent.create({
          data: { copyId, event: 'MESSAGE_RECEIVED' },
        });
      }
    }

    if (mediaUrl?.trim()) {
      // F-08: cap media per copy
      const mediaCount = await tx.beneficiaryImpactMedia.count({ where: { copyId } });
      if (mediaCount < MAX_MEDIA_PER_COPY) {
        await tx.beneficiaryImpactMedia.create({
          data: { copyId, beneficiaryUserId: user.userId, mediaUrl: mediaUrl.trim(), status: 'PENDING_REVIEW' },
        });
        await tx.sponsoredCopyEvent.create({
          data: { copyId, event: 'PHOTO_RECEIVED' },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
