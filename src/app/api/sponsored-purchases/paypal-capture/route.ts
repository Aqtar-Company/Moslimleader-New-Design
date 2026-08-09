export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { capturePayPalOrder } from '@/lib/paypal';
import { createSponsoredCopies } from '@/lib/support-system';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { paypalOrderId } = await req.json();
  if (!paypalOrderId) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  // Lookup expected amount (anti-replay)
  const pending = await prisma.setting.findUnique({ where: { key: `pp_sp_${paypalOrderId}` } });
  if (!pending) return NextResponse.json({ error: 'unknown_paypal_order' }, { status: 400 });

  const { sponsoredOrderId } = pending.value as { sponsoredOrderId: string; expectedUsd: number };

  const sponsoredOrder = await prisma.sponsoredOrder.findUnique({
    where: { id: sponsoredOrderId },
    include: { sponsor: true },
  });

  if (!sponsoredOrder) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (sponsoredOrder.sponsor.userId !== user.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Idempotency: already paid
  if (sponsoredOrder.paymentStatus === 'paid') {
    const copies = await prisma.sponsoredCopy.findMany({
      where: { sponsoredOrderId },
      select: { id: true, code: true },
    });
    return NextResponse.json({ ok: true, copies });
  }

  // Capture PayPal payment
  await capturePayPalOrder(paypalOrderId);

  // Mark order as paid and create copies
  await prisma.sponsoredOrder.update({
    where: { id: sponsoredOrderId },
    data: { paymentStatus: 'paid' },
  });

  const copies = await createSponsoredCopies(sponsoredOrderId);

  // Cleanup pending setting
  await prisma.setting.delete({ where: { key: `pp_sp_${paypalOrderId}` } }).catch(() => {});

  return NextResponse.json({ ok: true, copies });
}
