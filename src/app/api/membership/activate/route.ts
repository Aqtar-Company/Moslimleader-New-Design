export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { capturePayPalOrder } from '@/lib/paypal';

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { paypalOrderId } = await req.json().catch(() => ({}));
  if (!paypalOrderId) return NextResponse.json({ error: 'Missing paypalOrderId' }, { status: 400 });

  await capturePayPalOrder(paypalOrderId);

  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 1);

  const membership = await prisma.familyMembership.update({
    where: { ownerUserId: user.userId },
    data: {
      status: 'ACTIVE',
      startsAt: now,
      expiresAt: expires,
      paypalOrderId,
    },
  });

  return NextResponse.json({ ok: true, membership });
}
