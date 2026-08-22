export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createPayPalOrder } from '@/lib/paypal';
import { checkRateLimit } from '@/lib/rate-limit';

const PRICE_EGY_USD_DEFAULT  = 2.00;
const PRICE_INTL_USD_DEFAULT = 5.00;

async function getMembershipPrices(): Promise<{ egyUsd: number; intlUsd: number }> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['membership-price-egy-usd', 'membership-price-intl-usd'] } },
  });
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
  return {
    egyUsd:  parseFloat(map['membership-price-egy-usd']  ?? '') || PRICE_EGY_USD_DEFAULT,
    intlUsd: parseFloat(map['membership-price-intl-usd'] ?? '') || PRICE_INTL_USD_DEFAULT,
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser().catch(() => null);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = checkRateLimit(`membership-renew:${user.userId}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

    const { zone } = await req.json().catch(() => ({}));

    const membership = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });
    if (!membership) return NextResponse.json({ error: 'No membership found' }, { status: 404 });
    if (membership.status === 'ACTIVE' && membership.expiresAt && membership.expiresAt > new Date()) {
      return NextResponse.json({ error: 'العضوية نشطة بالفعل' }, { status: 409 });
    }

    const prices = await getMembershipPrices();
    const amountUsd = zone === 'egypt' ? prices.egyUsd : prices.intlUsd;
    const referenceId = `renew-${user.userId}-${Date.now()}`;

    let paypalOrderId: string;
    try {
      const paypalOrder = await createPayPalOrder(amountUsd, 'USD', referenceId);
      paypalOrderId = paypalOrder.id as string;
    } catch (err) {
      console.error('[renew-create] PayPal create order failed', err);
      return NextResponse.json({ error: 'فشل إنشاء طلب الدفع مع PayPal' }, { status: 502 });
    }

    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { paypalOrderId },
    });

    return NextResponse.json({ paypalOrderId });
  } catch (err) {
    console.error('[renew-create] unexpected error', err);
    return NextResponse.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 });
  }
}
