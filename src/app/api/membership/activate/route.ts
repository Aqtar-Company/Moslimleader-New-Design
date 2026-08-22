export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { capturePayPalOrder } from '@/lib/paypal';
import { checkRateLimit } from '@/lib/rate-limit';

const PRICE_EGY_EGP_DEFAULT = 100;

async function getEgyEgp(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'membership-price-egy-egp' } });
  return parseFloat(s?.value ?? '') || PRICE_EGY_EGP_DEFAULT;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser().catch(() => null);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = checkRateLimit(`membership-activate:${user.userId}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

    const { paypalOrderId } = await req.json().catch(() => ({}));
    if (!paypalOrderId || typeof paypalOrderId !== 'string') {
      return NextResponse.json({ error: 'Missing paypalOrderId' }, { status: 400 });
    }

    const existing = await prisma.familyMembership.findUnique({
      where: { ownerUserId: user.userId },
      select: { id: true, paypalOrderId: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'No pending membership found' }, { status: 404 });
    if (existing.status === 'ACTIVE') return NextResponse.json({ error: 'Already active' }, { status: 409 });
    if (existing.paypalOrderId !== paypalOrderId) {
      return NextResponse.json({ error: 'Order ID mismatch' }, { status: 403 });
    }

    try {
      await capturePayPalOrder(paypalOrderId);
    } catch (err) {
      console.error('[activate] PayPal capture failed', err);
      return NextResponse.json({ error: 'فشل تأكيد الدفع مع PayPal' }, { status: 502 });
    }

    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + 1);

    const amountEgp = await getEgyEgp();

    const updated = await prisma.familyMembership.updateMany({
      where: { ownerUserId: user.userId, status: { not: 'ACTIVE' } },
      data: { status: 'ACTIVE', startsAt: now, expiresAt: expires, paypalOrderId },
    });
    if (updated.count === 0) return NextResponse.json({ error: 'Already active' }, { status: 409 });

    const membership = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });

    await prisma.membershipRenewal.create({
      data: { membershipId: membership!.id, paypalOrderId, amountEgp, expiresAt: expires },
    });

    return NextResponse.json({ ok: true, membership });
  } catch (err) {
    console.error('[activate] unexpected error', err);
    return NextResponse.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 });
  }
}
