export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { getCustomerBalance } from '@/lib/customer-receivables';
import { NON_GIFT } from '@/lib/order-filters';

// GET — full operational view of one wholesale dealer:
//   - identity
//   - per-product purchase history (qty + total spend per product)
//   - per-order summary (date, items, total, status)
//   - running ledger balance (positive = they owe us)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('wholesale.read');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const [user, orders, balance] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, isWholesale: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { userId: id, ...NON_GIFT },
      select: {
        id: true, total: true, status: true, paymentMethod: true,
        currency: true, createdAt: true,
        items: {
          select: {
            id: true, productId: true, productName: true,
            quantity: true, unitPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    getCustomerBalance(id),
  ]);

  if (!user) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });

  // Aggregate purchases per product: total quantity, total revenue,
  // average unit price, last-purchase date. Helps the admin see what
  // this dealer typically buys at-a-glance.
  const productMap = new Map<string, {
    productId: string; productName: string;
    totalQuantity: number; totalRevenue: number;
    orderCount: number; lastPurchaseAt: string;
  }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = productMap.get(it.productId);
      const lineRevenue = it.unitPrice * it.quantity;
      const orderTime = o.createdAt.toISOString();
      if (cur) {
        cur.totalQuantity += it.quantity;
        cur.totalRevenue += lineRevenue;
        cur.orderCount += 1;
        if (orderTime > cur.lastPurchaseAt) cur.lastPurchaseAt = orderTime;
      } else {
        productMap.set(it.productId, {
          productId: it.productId,
          productName: it.productName,
          totalQuantity: it.quantity,
          totalRevenue: lineRevenue,
          orderCount: 1,
          lastPurchaseAt: orderTime,
        });
      }
    }
  }
  const products = Array.from(productMap.values())
    .map(p => ({ ...p, totalRevenue: Math.round(p.totalRevenue) }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalSpend = orders.reduce((s, o) => s + o.total, 0);
  const totalUnits = products.reduce((s, p) => s + p.totalQuantity, 0);

  return NextResponse.json({
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
    },
    products,
    orders: orders.map(o => ({
      id: o.id,
      total: o.total,
      status: o.status,
      paymentMethod: o.paymentMethod,
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
      itemCount: o.items.length,
      itemsSummary: o.items.map(i => `${i.productName} ×${i.quantity}`).join(' · '),
    })),
    summary: {
      orderCount: orders.length,
      totalSpend: Math.round(totalSpend),
      totalUnits,
      uniqueProducts: products.length,
      balance, // ledger balance (positive = they owe)
    },
  });
}
