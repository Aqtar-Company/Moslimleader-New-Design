export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status    = searchParams.get('status') ?? undefined;
  const productId = searchParams.get('productId') ?? undefined;
  const sponsorId = searchParams.get('sponsorId') ?? undefined;
  const search    = searchParams.get('search') ?? undefined;
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit     = 25;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (productId) where.productId = productId;
  if (sponsorId) where.sponsorId = sponsorId;
  if (search) {
    where.OR = [
      { code: { contains: search } },
    ];
  }

  const [total, copies] = await Promise.all([
    prisma.sponsoredCopy.count({ where }),
    prisma.sponsoredCopy.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, nameEn: true, images: true } },
        sponsor: { select: { id: true, name: true, organization: true } },
        beneficiaryUser: { select: { id: true, name: true, email: true } },
        supportRequest: { select: { id: true, status: true } },
      },
      orderBy: { purchasedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ copies, total, page, pages: Math.ceil(total / limit) });
}
