export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { copyId, message, mediaUrl } = body as { copyId: string; message?: string; mediaUrl?: string };

  if (!copyId) return NextResponse.json({ error: 'copyId required' }, { status: 400 });

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
      await tx.beneficiaryImpactMessage.create({
        data: { copyId, beneficiaryUserId: user!.userId, message: message.trim(), status: 'PENDING_REVIEW' },
      });
      await tx.sponsoredCopyEvent.create({
        data: { copyId, event: 'MESSAGE_RECEIVED' },
      });
    }

    if (mediaUrl?.trim()) {
      await tx.beneficiaryImpactMedia.create({
        data: { copyId, beneficiaryUserId: user!.userId, mediaUrl: mediaUrl.trim(), status: 'PENDING_REVIEW' },
      });
      await tx.sponsoredCopyEvent.create({
        data: { copyId, event: 'PHOTO_RECEIVED' },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
