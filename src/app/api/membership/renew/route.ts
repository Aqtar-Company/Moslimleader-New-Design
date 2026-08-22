export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createPayPalOrder, capturePayPalOrder } from '@/lib/paypal';
import { checkRateLimit } from '@/lib/rate-limit';

const PRICE_EGY_USD_DEFAULT  = 2.00;
const PRICE_INTL_USD_DEFAULT = 5.00;

const PRICE_EGY_EGP_DEFAULT  = 100;

async function getMembershipPrices(): Promise<{ egyUsd: number; intlUsd: number; egyEgp: number }> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['membership-price-egy-usd', 'membership-price-intl-usd', 'membership-price-egy-egp'] } },
  });
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
  return {
    egyUsd:  parseFloat(map['membership-price-egy-usd']  ?? '') || PRICE_EGY_USD_DEFAULT,
    intlUsd: parseFloat(map['membership-price-intl-usd'] ?? '') || PRICE_INTL_USD_DEFAULT,
    egyEgp:  parseFloat(map['membership-price-egy-egp']  ?? '') || PRICE_EGY_EGP_DEFAULT,
  };
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = checkRateLimit(`membership-renew:${user.userId}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const { action, paypalOrderId, zone } = await req.json().catch(() => ({}));

  const membership = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });
  if (!membership) return NextResponse.json({ error: 'No membership found' }, { status: 404 });

  if (action === 'create') {
    const prices = await getMembershipPrices();
    const amountUsd = zone === 'egypt' ? prices.egyUsd : prices.intlUsd;
    const referenceId = `renew-${user.userId}-${Date.now()}`;
    let orderId: string;
    try {
      const paypalOrder = await createPayPalOrder(amountUsd, 'USD', referenceId);
      orderId = paypalOrder.id as string;
    } catch (err) {
      console.error('[renew] PayPal create order failed', err);
      return NextResponse.json({ error: 'فشل إنشاء طلب الدفع مع PayPal' }, { status: 502 });
    }
    // Store the pending orderId so capture can cross-check it
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { paypalOrderId: orderId },
    });
    return NextResponse.json({ paypalOrderId: orderId, zone: zone === 'egypt' ? 'egypt' : 'intl' });
  }

  if (action === 'capture') {
    if (!paypalOrderId || typeof paypalOrderId !== 'string') {
      return NextResponse.json({ error: 'Missing paypalOrderId' }, { status: 400 });
    }
    // Cross-check paypalOrderId against what was stored during 'create'
    if (membership.paypalOrderId !== paypalOrderId) {
      return NextResponse.json({ error: 'Order ID mismatch' }, { status: 403 });
    }
    try {
      await capturePayPalOrder(paypalOrderId);
    } catch (err) {
      console.error('[renew] PayPal capture failed', err);
      return NextResponse.json({ error: 'فشل تأكيد الدفع مع PayPal' }, { status: 502 });
    }

    const base = membership.expiresAt && membership.expiresAt > new Date() ? membership.expiresAt : new Date();
    const newExpiry = new Date(base);
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);

    const prices = await getMembershipPrices();
    // zone passed from client for audit record only; PayPal already validated the actual amount
    const amountEgp = zone === 'egypt' ? prices.egyEgp : prices.intlUsd * 50;

    await prisma.$transaction([
      prisma.familyMembership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE', expiresAt: newExpiry, paypalOrderId },
      }),
      prisma.membershipRenewal.create({
        data: { membershipId: membership.id, paypalOrderId, amountEgp, expiresAt: newExpiry },
      }),
    ]);

    return NextResponse.json({ ok: true, expiresAt: newExpiry });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
