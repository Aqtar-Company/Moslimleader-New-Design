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

  const { sponsoredOrderId, expectedUsd } = pending.value as { sponsoredOrderId: string; expectedUsd: number };

  const sponsoredOrder = await prisma.sponsoredOrder.findUnique({
    where: { id: sponsoredOrderId },
    include: { sponsor: true },
  });

  if (!sponsoredOrder) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (sponsoredOrder.sponsor.userId !== user.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // H-5 / C-2: atomically claim the payment slot by transitioning from
  // 'pending' → 'paid'. Only the first concurrent request succeeds
  // (count=1); subsequent calls see count=0 and return existing copies.
  const claimed = await prisma.sponsoredOrder.updateMany({
    where: { id: sponsoredOrderId, paymentStatus: 'pending' },
    data: { paymentStatus: 'paid' },
  });

  if (claimed.count === 0) {
    // Already processed — return existing copies idempotently
    const copies = await prisma.sponsoredCopy.findMany({
      where: { sponsoredOrderId },
      select: { id: true, code: true },
    });
    return NextResponse.json({ ok: true, copies });
  }

  try {
    // Capture PayPal payment
    const capture = await capturePayPalOrder(paypalOrderId);

    // F-01: verify the captured amount matches what we expected
    const capturedValue = Number(
      capture?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ?? 0,
    );
    if (expectedUsd > 0 && Math.abs(capturedValue - expectedUsd) > 0.02) {
      // Rollback: revert order to pending so admin can investigate
      await prisma.sponsoredOrder.update({
        where: { id: sponsoredOrderId },
        data: { paymentStatus: 'pending', adminNote: `Amount mismatch: expected $${expectedUsd}, got $${capturedValue}` },
      });
      return NextResponse.json({ error: 'amount_mismatch' }, { status: 422 });
    }
  } catch (err) {
    // PayPal capture failed — rollback to pending
    await prisma.sponsoredOrder.update({
      where: { id: sponsoredOrderId },
      data: { paymentStatus: 'pending' },
    });
    throw err;
  }

  const copies = await createSponsoredCopies(sponsoredOrderId);

  // Cleanup pending setting
  await prisma.setting.delete({ where: { key: `pp_sp_${paypalOrderId}` } }).catch(() => {});

  return NextResponse.json({ ok: true, copies });
}
