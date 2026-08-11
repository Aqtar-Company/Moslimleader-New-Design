export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { logActionSafe } from '@/lib/audit-log';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requirePerm('sponsors.read');
  if (denied) return denied;

  const sponsor = await prisma.sponsor.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      sponsoredOrders: {
        include: { product: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      copies: {
        include: {
          product: { select: { id: true, name: true } },
          beneficiaryUser: { select: { id: true, name: true } },
        },
        orderBy: { purchasedAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!sponsor) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Compute summary stats
  const copies = sponsor.copies;
  const stats = {
    total: copies.length,
    available: copies.filter(c => c.status === 'AVAILABLE').length,
    assigned: copies.filter(c => ['ASSIGNED', 'IN_PREPARATION', 'READY_TO_SHIP'].includes(c.status)).length,
    shipped: copies.filter(c => c.status === 'SHIPPED').length,
    delivered: copies.filter(c => ['DELIVERED', 'CONFIRMED', 'COMPLETED'].includes(c.status)).length,
    confirmed: copies.filter(c => ['CONFIRMED', 'COMPLETED'].includes(c.status)).length,
    totalRetailValue: copies.reduce((s, c) => s + c.originalPrice, 0),
    currency: 'EGP',
  };

  return NextResponse.json({ sponsor, stats });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requirePerm('sponsors.write');
  if (denied) return denied;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await req.json();
  const { name, phone, email, organization, notes, isActive } = body;

  const before = await prisma.sponsor.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const updated = await prisma.sponsor.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(organization !== undefined ? { organization } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  await logActionSafe({
    actor: { userId: user.userId, role: user.role },
    action: 'sponsor.update',
    entity: 'Sponsor',
    entityId: params.id,
    before,
    after: updated,
  });

  return NextResponse.json({ sponsor: updated });
}
