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
  const country   = searchParams.get('country') ?? undefined;
  const search    = searchParams.get('search') ?? undefined;
  const supportSource = searchParams.get('supportSource') ?? undefined;
  const dateFrom  = searchParams.get('dateFrom') ?? undefined;
  const dateTo    = searchParams.get('dateTo') ?? undefined;
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit     = 25;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (productId) where.productId = productId;
  if (country) where.country = country;
  if (supportSource) where.supportType = supportSource;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
  }
  if (search) {
    where.OR = [
      { customerName: { contains: search } },
      { customerEmail: { contains: search } },
      { customerPhone: { contains: search } },
    ];
  }

  const [total, requests] = await Promise.all([
    prisma.supportRequest.count({ where }),
    prisma.supportRequest.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, nameEn: true, images: true, slug: true } },
        mlAllocation: { select: { supportAmount: true, customerPayAmount: true, status: true } },
        assignedCopy: {
          select: {
            id: true, code: true, status: true, sponsor: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Attach available sponsored copies count per product
  const productIds = [...new Set(requests.map(r => r.productId))];
  const availableCopies = await prisma.sponsoredCopy.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds }, status: 'AVAILABLE' },
    _count: { id: true },
  });
  const availableMap: Record<string, number> = {};
  for (const row of availableCopies) {
    availableMap[row.productId] = row._count.id;
  }

  return NextResponse.json({
    requests: requests.map(r => ({
      ...r,
      availableSponsoredCopies: availableMap[r.productId] ?? 0,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
