export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import {
  createSupportRequest,
  getSupportSettings,
  checkRequestEligibility,
} from '@/lib/support-system';

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

  const body = await req.json();
  const { productId, variantIndex, quantity = 1, reason, note, country } = body;

  if (!productId || !reason) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const eligibility = await checkRequestEligibility(user.userId, productId, country ?? 'EG');
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason }, { status: 422 });
  }

  // Load product and compute price snapshot server-side
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });

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
      country: country ?? 'EG',
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
