export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  createSupportRequest,
  getSupportSettings,
  checkRequestEligibility,
} from '@/lib/support-system';
import { loadStaticOverrides, applyOverride } from '@/lib/product-overrides';

// GET /api/support-requests — user's own requests
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requests = await prisma.supportRequest.findMany({
    where: { userId: user.userId },
    include: {
      product: { select: { id: true, name: true, nameEn: true, images: true, slug: true } },
      mlAllocation: { select: { supportAmount: true, customerPayAmount: true, status: true } },
      assignedCopy: { select: { code: true, status: true, shippedAt: true, deliveredAt: true, trackingNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ requests });
}

// POST /api/support-requests — create a new request
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await getSupportSettings();
  if (!settings.featureEnabled) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 });
  }

  // F-02/F-05: rate limit — max 5 requests per user per hour
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { allowed } = checkRateLimit(`support-req:${user.userId}:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = await req.json();
  const { productId, variantIndex, quantity = 1, reason, note, country } = body;

  // F-06: validate reason against allowed enum
  const ALLOWED_REASONS = ['financial_hardship', 'low_income', 'large_family', 'student', 'other'];
  if (!productId || !reason || !ALLOWED_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // F-13: server-side length limits
  if (note && note.length > 500) {
    return NextResponse.json({ error: 'note_too_long' }, { status: 400 });
  }

  // F-12: validate country is ISO-3166-1 alpha-2 (exactly 2 uppercase letters)
  const resolvedCountry = country ?? 'EG';
  if (!/^[A-Z]{2}$/.test(resolvedCountry)) {
    return NextResponse.json({ error: 'invalid_country' }, { status: 400 });
  }

  const eligibility = await checkRequestEligibility(user.userId, productId, resolvedCountry);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason }, { status: 422 });
  }

  // Load product and compute price snapshot server-side
  const rawProduct = await prisma.product.findUnique({ where: { id: productId } });
  if (!rawProduct) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });

  // H-4: apply product-overrides for static products so the snapshot
  // reflects the admin-configured price, not the stale DB copy.
  let product = rawProduct as typeof rawProduct & { price: number };
  if (rawProduct.source === 'static') {
    const overrides = await loadStaticOverrides();
    const merged = applyOverride(rawProduct as Parameters<typeof applyOverride>[0], overrides[rawProduct.id]);
    if (merged) product = merged as typeof product;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { name: true, email: true, phone: true },
  });

  const snapshotProductPrice = product.price;
  const snapshotDiscount = 0;
  const snapshotEligiblePrice = snapshotProductPrice - snapshotDiscount;

  try {
    const request = await createSupportRequest({
      userId: user.userId,
      productId,
      variantIndex: variantIndex !== undefined ? Number(variantIndex) : undefined,
      quantity: Number(quantity),
      reason,
      note: note?.trim() || undefined,
      country: resolvedCountry,
      snapshotProductPrice,
      snapshotDiscount,
      snapshotEligiblePrice,
      snapshotShipping: 0,
      currency: 'EGP',
      customerName: dbUser?.name ?? user.name ?? 'عميل',
      customerPhone: dbUser?.phone ?? undefined,
      customerEmail: dbUser?.email ?? user.email,
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'error';
    if (msg.startsWith('ineligible:')) {
      return NextResponse.json({ error: msg.replace('ineligible:', '') }, { status: 422 });
    }
    console.error('[support-requests POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
