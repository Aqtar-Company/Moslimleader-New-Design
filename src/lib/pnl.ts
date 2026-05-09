import { prisma } from './prisma';

// Period-bound P&L computation. Used by /api/admin/accounting to
// render "this month / last month / quarter / YTD / TTM" snapshots,
// using the SAME methodology the valuation route uses for TTM (so
// when the period equals TTM the numbers reconcile).
//
// Inputs:
// - start, end: half-open interval [start, end). end defaults to now.
// - cogsRatio: fallback when a product has no production batches.
// - avgCostByProduct: per-product weighted-avg unit cost from
//   ProductionBatch. Pass an empty Map and every line falls back to
//   `unitPrice × cogsRatio` (the cheap path).
//
// Output: revenue (Order.total — includes shipping, post-discount),
// itemRevenue (Σ unitPrice × qty — excludes shipping), cogs, gross
// profit + margin, order count.

export interface PnlPeriod {
  start: Date;
  end?: Date;
}

export interface PnlResult {
  start: string;
  end: string;
  revenue: number;        // Σ Order.total (post-discount, incl. shipping)
  itemRevenue: number;    // Σ OrderItem.unitPrice × qty
  shipping: number;
  discount: number;
  cogs: number;
  grossProfit: number;    // itemRevenue − cogs
  grossMargin: number;    // grossProfit / itemRevenue
  orderCount: number;
  unitsSold: number;
}

const NON_GIFT = {
  status: { not: 'cancelled' },
  paymentMethod: { not: 'gift' },
} as const;

export async function getPnlForPeriod(
  period: PnlPeriod,
  ctx: { cogsRatio: number; avgCostByProduct: Map<string, number> },
): Promise<PnlResult> {
  const start = period.start;
  const end = period.end ?? new Date();
  const where = {
    ...NON_GIFT,
    createdAt: { gte: start, lt: end },
  };

  const [orderAgg, itemRows] = await Promise.all([
    prisma.order.aggregate({
      where,
      _sum: { total: true, shippingCost: true, discount: true },
      _count: { _all: true },
    }),
    prisma.orderItem.findMany({
      where: { order: where },
      select: { productId: true, quantity: true, unitPrice: true },
    }),
  ]);

  let itemRevenue = 0;
  let cogs = 0;
  let unitsSold = 0;
  for (const it of itemRows) {
    const lineRevenue = it.unitPrice * it.quantity;
    itemRevenue += lineRevenue;
    unitsSold += it.quantity;
    const avg = ctx.avgCostByProduct.get(it.productId);
    cogs += avg !== undefined && avg > 0
      ? avg * it.quantity
      : lineRevenue * ctx.cogsRatio;
  }
  const grossProfit = itemRevenue - cogs;
  const grossMargin = itemRevenue > 0 ? grossProfit / itemRevenue : 0;

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    revenue: Math.round(orderAgg._sum.total ?? 0),
    itemRevenue: Math.round(itemRevenue),
    shipping: Math.round(orderAgg._sum.shippingCost ?? 0),
    discount: Math.round(orderAgg._sum.discount ?? 0),
    cogs: Math.round(cogs),
    grossProfit: Math.round(grossProfit),
    grossMargin,
    orderCount: orderAgg._count._all,
    unitsSold,
  };
}

// Predefined period boundaries used by the accounting page selector.
// Keys map 1:1 to UI buttons; values are computed at call time so each
// snapshot is correct even if the request straddles midnight.
export type PeriodKey = 'this-month' | 'last-month' | 'this-quarter' | 'ytd' | 'ttm';

export function periodBoundaries(key: PeriodKey, now: Date = new Date()): PnlPeriod {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'this-month':
      return { start: new Date(y, m, 1), end: now };
    case 'last-month':
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
    case 'this-quarter': {
      const qStart = m - (m % 3);
      return { start: new Date(y, qStart, 1), end: now };
    }
    case 'ytd':
      return { start: new Date(y, 0, 1), end: now };
    case 'ttm':
      return { start: new Date(now.getTime() - 365 * 86400000), end: now };
  }
}
