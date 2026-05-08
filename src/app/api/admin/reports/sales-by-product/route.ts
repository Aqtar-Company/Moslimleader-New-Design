export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { NON_GIFT, NON_GIFT_LIVE, GIFT_ONLY, IS_IMPORT_ORDER } from '@/lib/order-filters';

// GET /api/admin/reports/sales-by-product
//   Returns one row per product: lifetime/live/import/gift unit counts,
//   order count, revenue, first/last sale dates, current stock, and the
//   implied opening-balance gap (currentStock + unitsAll − productionBatchUnits).
// GET ?productId=XYZ
//   Returns the per-product summary AND a drill-down `orders` array so
//   the UI can show the actual orders that consumed that product.
export async function GET(req: NextRequest) {
  const guard = await requirePerm('valuation.read');
  if ('response' in guard) return guard.response;

  const productId = req.nextUrl.searchParams.get('productId') || undefined;

  if (productId) {
    return drilldownResponse(productId);
  }
  return summaryResponse();
}

async function summaryResponse() {
  // Four parallel groupBys give us the per-bucket unit counts. We keep
  // the queries flat (no joins) so they stay fast even with 2k+ orders.
  const [allUnits, liveUnits, giftUnits, importUnits, products, batches, orderCounts, dateRanges, revenue] = await Promise.all([
    prisma.orderItem.groupBy({ by: ['productId'], where: { order: NON_GIFT },      _sum: { quantity: true } }),
    prisma.orderItem.groupBy({ by: ['productId'], where: { order: NON_GIFT_LIVE }, _sum: { quantity: true } }),
    prisma.orderItem.groupBy({ by: ['productId'], where: { order: GIFT_ONLY },     _sum: { quantity: true } }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { ...IS_IMPORT_ORDER, status: { not: 'cancelled' } } },
      _sum: { quantity: true },
    }),
    prisma.product.findMany({
      select: { id: true, name: true, slug: true, category: true, price: true, stock: true },
    }),
    prisma.productionBatch.groupBy({ by: ['productId'], _sum: { quantity: true } }),
    // Distinct order count per product = count distinct orderId from items
    // where order is non-cancelled (gifts and imports both count).
    prisma.$queryRaw<Array<{ productId: string; cnt: bigint }>>`
      SELECT oi.productId AS productId, COUNT(DISTINCT oi.orderId) AS cnt
      FROM OrderItem oi
      JOIN \`Order\` o ON o.id = oi.orderId
      WHERE o.status != 'cancelled'
      GROUP BY oi.productId
    `,
    // First & last sale dates per product. Cheaper to do via raw SQL than
    // pull every OrderItem then aggregate in JS.
    prisma.$queryRaw<Array<{ productId: string; firstAt: Date; lastAt: Date }>>`
      SELECT oi.productId AS productId, MIN(o.createdAt) AS firstAt, MAX(o.createdAt) AS lastAt
      FROM OrderItem oi
      JOIN \`Order\` o ON o.id = oi.orderId
      WHERE o.status != 'cancelled'
      GROUP BY oi.productId
    `,
    // Revenue: sum of unitPrice × quantity for non-gift non-cancelled.
    prisma.$queryRaw<Array<{ productId: string; rev: number }>>`
      SELECT oi.productId AS productId, COALESCE(SUM(oi.unitPrice * oi.quantity), 0) AS rev
      FROM OrderItem oi
      JOIN \`Order\` o ON o.id = oi.orderId
      WHERE o.status != 'cancelled' AND o.paymentMethod != 'gift'
      GROUP BY oi.productId
    `,
  ]);

  const allMap = mapBy(allUnits);
  const liveMap = mapBy(liveUnits);
  const giftMap = mapBy(giftUnits);
  const importMap = mapBy(importUnits);
  const batchMap = mapBy(batches);
  const orderCountMap = new Map(orderCounts.map(r => [r.productId, Number(r.cnt)]));
  const dateMap = new Map(dateRanges.map(r => [r.productId, { first: r.firstAt, last: r.lastAt }]));
  const revMap = new Map(revenue.map(r => [r.productId, Number(r.rev)]));

  const rows = products.map(p => {
    const unitsAll = allMap.get(p.id) ?? 0;
    const unitsLive = liveMap.get(p.id) ?? 0;
    const unitsImported = importMap.get(p.id) ?? 0;
    const unitsGift = giftMap.get(p.id) ?? 0;
    const productionBatchUnits = batchMap.get(p.id) ?? 0;
    const rev = revMap.get(p.id) ?? 0;
    const range = dateMap.get(p.id);
    return {
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      category: p.category,
      retailPrice: p.price,
      currentStock: p.stock,
      unitsAll,
      unitsLive,
      unitsImported,
      unitsGift,
      orderCount: orderCountMap.get(p.id) ?? 0,
      revenue: Math.round(rev * 100) / 100,
      avgUnitPrice: unitsAll - unitsGift > 0 ? Math.round((rev / (unitsAll - unitsGift)) * 100) / 100 : 0,
      firstSaleAt: range?.first ? range.first.toISOString() : null,
      lastSaleAt:  range?.last  ? range.last.toISOString()  : null,
      productionBatchUnits,
      // The user paid for these units somewhere; if there are no batches
      // covering them, this is the implied opening balance the wizard
      // (after Phase B) will surface. Used by the "needs opening balance"
      // chip on /admin/valuation too.
      impliedOpeningBalance: Math.max(0, p.stock + unitsAll - productionBatchUnits),
      needsOpeningBalance: productionBatchUnits === 0 && unitsAll > 0,
    };
  });

  // Sort: best-sellers first by lifetime units. Front-end can re-sort.
  rows.sort((a, b) => b.unitsAll - a.unitsAll);

  // Top-line aggregates for the KPI strip.
  const totals = rows.reduce((acc, r) => ({
    productsWithSales:    acc.productsWithSales + (r.unitsAll > 0 ? 1 : 0),
    productsNeedingBalance: acc.productsNeedingBalance + (r.needsOpeningBalance ? 1 : 0),
    unitsAll:             acc.unitsAll + r.unitsAll,
    unitsLive:            acc.unitsLive + r.unitsLive,
    unitsImported:        acc.unitsImported + r.unitsImported,
    unitsGift:            acc.unitsGift + r.unitsGift,
    revenue:              acc.revenue + r.revenue,
    impliedOpeningBalance: acc.impliedOpeningBalance + r.impliedOpeningBalance,
  }), { productsWithSales: 0, productsNeedingBalance: 0, unitsAll: 0, unitsLive: 0, unitsImported: 0, unitsGift: 0, revenue: 0, impliedOpeningBalance: 0 });

  return NextResponse.json({ rows, totals });
}

async function drilldownResponse(productId: string) {
  // For the drill-down panel: every order that contains this product.
  // Capped at 500 rows because a few popular products could otherwise
  // ship a multi-MB payload; we surface the true total separately so
  // the UI can show a "showing 500 of N" banner if needed.
  const where = { productId, order: { status: { not: 'cancelled' } } } as const;
  const [items, total] = await Promise.all([
    prisma.orderItem.findMany({
      where,
      include: {
        order: {
          select: {
            id: true, status: true, paymentMethod: true, source: true,
            createdAt: true, currency: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
      take: 500,
    }),
    prisma.orderItem.count({ where }),
  ]);

  const orders = items.map(it => ({
    orderItemId: it.id,
    orderId: it.orderId,
    orderCreatedAt: it.order.createdAt.toISOString(),
    status: it.order.status,
    paymentMethod: it.order.paymentMethod,
    source: it.order.source,
    currency: it.order.currency,
    customerName: it.order.user?.name ?? null,
    customerEmail: it.order.user?.email ?? null,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    selectedModel: it.selectedModel,
  }));

  return NextResponse.json({ productId, orders, total, truncated: total > orders.length });
}

function mapBy(rows: Array<{ productId: string; _sum: { quantity: number | null } }>): Map<string, number> {
  return new Map(rows.map(r => [r.productId, Number(r._sum.quantity ?? 0)]));
}
