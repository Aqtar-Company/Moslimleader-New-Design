export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createPayPalOrder, capturePayPalOrder } from '@/lib/paypal';

const MEMBERSHIP_PRICE_USD = 2.00;

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, paypalOrderId } = await req.json().catch(() => ({}));

  const membership = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });
  if (!membership) return NextResponse.json({ error: 'No membership found' }, { status: 404 });

  if (action === 'create') {
    const orderId = await createPayPalOrder(MEMBERSHIP_PRICE_USD, 'Moslim Leader Membership Renewal');
    return NextResponse.json({ paypalOrderId: orderId });
  }

  if (action === 'capture') {
    if (!paypalOrderId) return NextResponse.json({ error: 'Missing paypalOrderId' }, { status: 400 });
    await capturePayPalOrder(paypalOrderId);

    // Extend from current expiry (or now if expired)
    const base = membership.expiresAt && membership.expiresAt > new Date() ? membership.expiresAt : new Date();
    const newExpiry = new Date(base);
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);

    await prisma.$transaction([
      prisma.familyMembership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE', expiresAt: newExpiry, paypalOrderId },
      }),
      prisma.membershipRenewal.create({
        data: { membershipId: membership.id, paypalOrderId, amountEgp: 100, expiresAt: newExpiry },
      }),
    ]);

    return NextResponse.json({ ok: true, expiresAt: newExpiry });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
