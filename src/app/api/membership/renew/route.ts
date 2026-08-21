export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createPayPalOrder, capturePayPalOrder } from '@/lib/paypal';
import { checkRateLimit } from '@/lib/rate-limit';

const MEMBERSHIP_PRICE_USD = 2.00;

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = checkRateLimit(`membership-renew:${user.userId}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const { action, paypalOrderId } = await req.json().catch(() => ({}));

  const membership = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });
  if (!membership) return NextResponse.json({ error: 'No membership found' }, { status: 404 });

  if (action === 'create') {
    // F-2: correct arg order — (amount, currency, referenceId)
    const referenceId = `renew-${user.userId}-${Date.now()}`;
    const orderId = await createPayPalOrder(MEMBERSHIP_PRICE_USD, 'USD', referenceId);
    // Store the pending orderId so capture can cross-check it
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { paypalOrderId: orderId },
    });
    return NextResponse.json({ paypalOrderId: orderId });
  }

  if (action === 'capture') {
    if (!paypalOrderId || typeof paypalOrderId !== 'string') {
      return NextResponse.json({ error: 'Missing paypalOrderId' }, { status: 400 });
    }
    // Cross-check paypalOrderId against what was stored during 'create'
    if (membership.paypalOrderId !== paypalOrderId) {
      return NextResponse.json({ error: 'Order ID mismatch' }, { status: 403 });
    }
    await capturePayPalOrder(paypalOrderId);

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
