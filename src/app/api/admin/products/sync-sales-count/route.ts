export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// POST /api/admin/products/sync-sales-count
// One-time (or periodic) job: recalculates salesCount for every product
// by summing quantities from all non-cancelled orders in OrderItem.
export async function POST() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  // Sum quantities per productId, excluding cancelled orders
  const rows = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        status: { notIn: ['cancelled', 'refunded'] },
      },
    },
    _sum: { quantity: true },
  });

  let updated = 0;
  for (const row of rows) {
    const count = row._sum.quantity ?? 0;
    if (count > 0) {
      await prisma.product.updateMany({
        where: { id: row.productId },
        data: { salesCount: count },
      });
      updated++;
    }
  }

  return NextResponse.json({ ok: true, updated, total: rows.length });
}
