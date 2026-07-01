export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

// GET /api/admin/production-files — list latest versions (optionally filter by productId or category)
export async function GET(req: NextRequest) {
  const guard = await requirePerm('production-files.read');
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId') ?? undefined;
  const category = searchParams.get('category') ?? undefined;

  const files = await prisma.productionFile.findMany({
    where: {
      isLatest: true,
      ...(productId ? { productId } : {}),
      ...(category ? { category } : {}),
    },
    include: {
      product: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ files });
}
