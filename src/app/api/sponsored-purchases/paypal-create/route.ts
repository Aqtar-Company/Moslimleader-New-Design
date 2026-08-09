export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { createPayPalOrder } from '@/lib/paypal';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // F-05: rate limit — max 10 PayPal order creations per user per hour
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { allowed } = checkRateLimit(`paypal-create-sp:${user.userId}:${ip}`, 10, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const { sponsoredOrderId } = await req.json();
  if (!sponsoredOrderId) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  const order = await prisma.sponsoredOrder.findUnique({
    where: { id: sponsoredOrderId },
    include: { sponsor: true },
  });

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (order.sponsor.userId !== user.userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (order.paymentStatus !== 'pending') {
    return NextResponse.json({ error: 'already_paid' }, { status: 422 });
  }

  // Store expected amount for anti-replay check
  const expectedAmountUsd = order.totalPaid / 50; // EGP to USD
  const referenceId = `sp-${user.userId}-${Date.now()}`;

  const paypalOrder = await createPayPalOrder(
    Number(expectedAmountUsd.toFixed(2)),
    'USD',
    referenceId,
  );

  // Store expected amount for capture verification
  await prisma.setting.upsert({
    where: { key: `pp_sp_${paypalOrder.id}` },
    create: { key: `pp_sp_${paypalOrder.id}`, value: { sponsoredOrderId, expectedUsd: expectedAmountUsd } },
    update: { value: { sponsoredOrderId, expectedUsd: expectedAmountUsd } },
  });

  await prisma.sponsoredOrder.update({
    where: { id: sponsoredOrderId },
    data: { paypalOrderId: paypalOrder.id },
  });

  return NextResponse.json({ paypalOrderId: paypalOrder.id });
}
