export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
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

function generateQRToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  return 'ML-' + Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function generateMembershipNumber(): Promise<string> {
  // Use highest existing number to avoid TOCTOU collisions under concurrent signups
  const year = String(new Date().getFullYear()).slice(1); // "026" for 2026
  const latest = await prisma.familyMembership.findFirst({
    where: { membershipNumber: { startsWith: `ML-${year}-` } },
    orderBy: { membershipNumber: 'desc' },
    select: { membershipNumber: true },
  });
  let seq = 1;
  if (latest?.membershipNumber) {
    const parts = latest.membershipNumber.split('-');
    seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
  }
  return `ML-${year}-${String(seq).padStart(5, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser().catch(() => null);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = checkRateLimit(`membership-create:${user.userId}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

    const { familyName, zone } = await req.json().catch(() => ({}));
    const prices = await getMembershipPrices();
    const amountUsd = zone === 'egypt' ? prices.egyUsd : prices.intlUsd;

    const existing = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });
    if (existing && existing.status === 'ACTIVE') {
      return NextResponse.json({ error: 'Already an active member' }, { status: 409 });
    }

    let paypalOrderId: string;
    try {
      const paypalOrder = await createPayPalOrder(amountUsd, 'USD', 'Moslim Leader Family Membership');
      paypalOrderId = paypalOrder.id as string;
    } catch (err) {
      console.error('[membership-create] PayPal create order failed', err);
      return NextResponse.json({ error: 'فشل إنشاء طلب الدفع مع PayPal' }, { status: 422 });
    }

    if (!existing) {
      const membershipNumber = await generateMembershipNumber();
      let qrToken = generateQRToken();
      while (await prisma.familyMembership.findUnique({ where: { qrToken } })) {
        qrToken = generateQRToken();
      }
      await prisma.familyMembership.create({
        data: {
          ownerUserId: user.userId,
          membershipNumber,
          qrToken,
          familyName: familyName?.trim() || null,
          memberSince: new Date().getFullYear(),
          status: 'PENDING',
          paypalOrderId,
        },
      });
    } else {
      await prisma.familyMembership.update({
        where: { id: existing.id },
        data: {
          familyName: familyName?.trim() || existing.familyName,
          paypalOrderId,
          status: 'PENDING',
        },
      });
    }

    return NextResponse.json({ paypalOrderId, amountUsd });
  } catch (err) {
    console.error('[membership-create] unexpected error', err);
    return NextResponse.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 });
  }
}
