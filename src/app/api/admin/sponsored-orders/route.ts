export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createSponsoredCopies, getOrCreateSponsorForUser } from '@/lib/support-system';
import { logActionSafe } from '@/lib/audit-log';

export async function GET(req: NextRequest) {
  const denied = await requirePerm('support-requests.read');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 25;

  const [total, orders] = await Promise.all([
    prisma.sponsoredOrder.count(),
    prisma.sponsoredOrder.findMany({
      include: {
        sponsor: { select: { id: true, name: true, organization: true } },
        product: { select: { id: true, name: true } },
        _count: { select: { copies: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
}

// Admin creates a sponsored order (for large donors who pay offline)
export async function POST(req: NextRequest) {
  const denied = await requirePerm('sponsors.write');
  if (denied) return denied;
  const user = await getAuthUser();

  const body = await req.json();
  const {
    sponsorId, sponsorData, // provide one of these
    productId, variantIndex, quantity,
    pricePerCopy,
    paymentMethod, paymentRef, adminNote,
    markPaidNow = false,
  } = body;

  if (!productId || !quantity || !pricePerCopy) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  let resolvedSponsorId = sponsorId;

  if (!resolvedSponsorId && sponsorData) {
    if (sponsorData.userId) {
      // Linked to an existing user account
      const sponsor = await getOrCreateSponsorForUser(
        sponsorData.userId,
        { name: sponsorData.name, phone: sponsorData.phone, email: sponsorData.email },
      );
      resolvedSponsorId = sponsor.id;
    } else {
      // C-4: anonymous offline donor — create without userId to avoid FK violation
      const sponsor = await prisma.sponsor.create({
        data: {
          userId: null,
          name: sponsorData.name ?? 'داعم مجهول',
          phone: sponsorData.phone ?? null,
          email: sponsorData.email ?? null,
        },
      });
      resolvedSponsorId = sponsor.id;
    }
  }

  if (!resolvedSponsorId) {
    return NextResponse.json({ error: 'missing_sponsor' }, { status: 400 });
  }

  const qty = Math.max(1, Number(quantity));
  const unitPrice = Number(pricePerCopy);

  const order = await prisma.sponsoredOrder.create({
    data: {
      sponsorId: resolvedSponsorId,
      productId,
      variantIndex: variantIndex !== undefined ? Number(variantIndex) : null,
      quantity: qty,
      pricePerCopy: unitPrice,
      totalPaid: unitPrice * qty,
      currency: 'EGP',
      paymentMethod: paymentMethod ?? 'admin-entry',
      paymentStatus: markPaidNow ? 'paid' : 'pending',
      paymentRef: paymentRef ?? null,
      adminNote: adminNote ?? null,
      createdByUserId: user.userId,
      policyAgreed: true,
    },
  });

  await logActionSafe({
    actor: { userId: user.userId, role: user.role },
    action: 'sponsored-order.create',
    entity: 'SponsoredOrder',
    entityId: order.id,
    after: { quantity: qty, productId, sponsorId: resolvedSponsorId },
  });

  // If marked paid immediately, create copies
  if (markPaidNow) {
    const copies = await createSponsoredCopies(order.id, user.userId);
    return NextResponse.json({ order, copies }, { status: 201 });
  }

  return NextResponse.json({ order }, { status: 201 });
}
