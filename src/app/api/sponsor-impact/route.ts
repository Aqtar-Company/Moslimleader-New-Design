export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sponsor = await prisma.sponsor.findFirst({
    where: { userId: user.userId },
    include: {
      _count: { select: { copies: true } },
    },
  });

  if (!sponsor) return NextResponse.json({ error: 'not_sponsor' }, { status: 404 });

  const copies = await prisma.sponsoredCopy.findMany({
    where: { sponsoredOrderId: { in: await prisma.sponsoredOrder.findMany({ where: { sponsorId: sponsor.id }, select: { id: true } }).then(ords => ords.map(o => o.id)) } },
    include: {
      product: { select: { name: true } },
      impactMessages: { where: { status: 'APPROVED' }, select: { id: true, message: true, status: true } },
      impactMedia: { where: { status: 'APPROVED' }, select: { id: true, mediaUrl: true, status: true } },
    },
    orderBy: { purchasedAt: 'desc' },
  });

  const delivered = copies.filter(c => ['DELIVERED', 'CONFIRMED', 'COMPLETED'].includes(c.status)).length;
  const confirmed = copies.filter(c => ['CONFIRMED', 'COMPLETED'].includes(c.status)).length;
  const totalRetailValue = copies.reduce((sum, c) => sum + c.originalPrice, 0);

  return NextResponse.json({
    sponsor: {
      id: sponsor.id,
      name: sponsor.name,
      organization: sponsor.organization,
      stats: {
        totalCopies: copies.length,
        deliveredCopies: delivered,
        confirmedCopies: confirmed,
        totalRetailValue,
      },
    },
    copies: copies.map(c => ({
      id: c.id,
      code: c.code,
      status: c.status,
      product: c.product,
      impactMessages: c.impactMessages,
      impactMedia: c.impactMedia,
      deliveredAt: c.deliveredAt?.toISOString(),
    })),
  });
}
