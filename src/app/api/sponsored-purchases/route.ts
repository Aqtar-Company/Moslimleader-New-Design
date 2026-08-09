export const dynamic = 'force-dynamic';

/**
 * POST /api/sponsored-purchases
 *
 * Creates a SponsoredOrder for a logged-in user who wants to sponsor
 * product copies for beneficiaries. Payment is handled separately via
 * /api/sponsored-purchases/paypal-create + /paypal-capture.
 *
 * For non-PayPal (bank transfer / admin entry), use admin routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { getOrCreateSponsorForUser, getSupportSettings } from '@/lib/support-system';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await getSupportSettings();
  if (!settings.featureEnabled) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 });
  }

  // F-05: rate limit — max 5 sponsored orders per user per hour
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { allowed } = checkRateLimit(`sponsored-purchase:${user.userId}:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = await req.json();
  const { productId, variantIndex, quantity = 1, policyAgreed } = body;

  if (!productId || !policyAgreed) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const qty = Math.max(1, Math.min(100, Number(quantity)));

  // Check max sponsored copies per product
  const availableCount = await prisma.sponsoredCopy.count({
    where: {
      productId,
      status: { in: ['AVAILABLE', 'RESERVED', 'ASSIGNED', 'IN_PREPARATION', 'READY_TO_SHIP'] },
    },
  });

  if (availableCount + qty > settings.maxSponsoredCopiesPerProduct) {
    return NextResponse.json({ error: 'max_copies_reached' }, { status: 422 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, price: true, inStock: true },
  });
  if (!product) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { name: true, email: true, phone: true },
  });

  const sponsor = await getOrCreateSponsorForUser(user.userId, {
    name: dbUser?.name ?? user.name ?? 'داعم',
    phone: dbUser?.phone ?? undefined,
    email: dbUser?.email ?? user.email,
  });

  const sponsoredOrder = await prisma.sponsoredOrder.create({
    data: {
      sponsorId: sponsor.id,
      productId,
      variantIndex: variantIndex !== undefined ? Number(variantIndex) : null,
      quantity: qty,
      pricePerCopy: product.price,
      totalPaid: product.price * qty,
      currency: 'EGP',
      paymentMethod: 'paypal',
      paymentStatus: 'pending',
      policyAgreed: true,
    },
  });

  return NextResponse.json({ sponsoredOrder }, { status: 201 });
}
