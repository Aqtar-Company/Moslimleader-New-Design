export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
  const products = await prisma.product.findMany({
    select: {
      id: true, slug: true, name: true, price: true, priceUsd: true,
      images: true, inStock: true, stock: true, category: true,
    },
    orderBy: { name: 'asc' },
  });

  // Aggregate sold-counts per product (excluding cancelled orders) so the admin
  // can see real demand alongside available stock.
  const sold = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { order: { status: { not: 'cancelled' } } },
    _sum: { quantity: true },
  });
  const soldMap = new Map(sold.map(s => [s.productId, s._sum.quantity ?? 0]));

  return NextResponse.json({
    products: products.map(p => ({
      ...p,
      sold: soldMap.get(p.id) ?? 0,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
  const body = await req.json() as { productId: string; stock?: number; delta?: number; inStock?: boolean };
  if (!body.productId) return NextResponse.json({ error: 'productId مطلوب' }, { status: 400 });

  const data: { stock?: number | { increment: number }; inStock?: boolean } = {};
  if (typeof body.stock === 'number') data.stock = Math.max(0, Math.floor(body.stock));
  else if (typeof body.delta === 'number') data.stock = { increment: Math.floor(body.delta) };
  if (typeof body.inStock === 'boolean') data.inStock = body.inStock;

  const product = await prisma.product.update({
    where: { id: body.productId },
    data,
  });
  return NextResponse.json({ product });
}
