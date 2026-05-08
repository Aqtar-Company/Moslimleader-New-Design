export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import {
  getValuationAssumptions,
  saveValuationAssumptions,
  DEFAULT_VALUATION_ASSUMPTIONS,
  type ValuationAssumptions,
} from '@/lib/valuation-assumptions';
import { logActionSafe } from '@/lib/audit-log';
import { totalReceivables } from '@/lib/customer-receivables';

// GET /api/admin/valuation — live company valuation report.
// Gated solely on the `valuation.read` permission. The previous double
// gate (perm + standalone password) was redundant: an admin who has
// the perm shouldn't need to remember a separate password, and an
// assistant without the perm couldn't reach this endpoint anyway.
export async function GET() {
  const guard = await requirePerm('valuation.read');
  if ('response' in guard) return guard.response;

  const assumptions = await getValuationAssumptions();

  // Gifts (paymentMethod = 'gift') and cancellations are excluded from the
  // revenue/sales aggregations and reported in their own buckets so a user
  // of the report can decide how to treat them.
  const NON_GIFT = { status: { not: 'cancelled' }, paymentMethod: { not: 'gift' } } as const;
  const GIFT     = { status: { not: 'cancelled' }, paymentMethod: 'gift' } as const;
  const CANCELLED = { status: 'cancelled' } as const;
  // 'Live' = orders that flowed through the live system (customer checkout,
  // PayPal, admin manual). Excludes historical imports whose stock was
  // already decremented before the system existed (or never tracked at all).
  // Without this filter, soldLifetime drifts above real-world inventory loss.
  const IMPORT_SOURCES = ['whatsapp_cleaned_ready'];
  const IMPORT_PAYMENT_METHODS = ['bosta-historical'];
  const NON_GIFT_LIVE = {
    status: { not: 'cancelled' },
    paymentMethod: { notIn: ['gift', ...IMPORT_PAYMENT_METHODS] },
    OR: [{ source: null }, { source: { notIn: IMPORT_SOURCES } }],
  };

  const activeSince = new Date();
  activeSince.setDate(activeSince.getDate() - assumptions.activeWindowDays);

  const [
    products, books,
    orderAgg, orderCount, validOrderCount,
    customerCount, wholesaleCount, shipmentCount,
    sold, soldLive, ordersByYear, ordersByMonth,
    giftOrders, giftItemsAgg,
    cancelledAgg,
    activeBuyersRaw, repeatBuyersRaw, totalBuyersRaw,
  ] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true, name: true, nameEn: true, slug: true, price: true, priceUsd: true,
        category: true, inStock: true, stock: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.book.findMany({
      select: {
        id: true, title: true, titleEn: true, price: true, priceUSD: true,
        isPublished: true, language: true,
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true, shippingCost: true, discount: true },
      where: NON_GIFT,
    }),
    prisma.order.count(),
    prisma.order.count({ where: NON_GIFT }),
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.user.count({ where: { role: 'customer', isWholesale: true } }),
    prisma.shipment.count(),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: NON_GIFT },
      _sum: { quantity: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: NON_GIFT_LIVE },
      _sum: { quantity: true },
    }),
    prisma.$queryRaw<Array<{ year: number; revenue: number; count: bigint }>>`
      SELECT YEAR(createdAt) as year, SUM(total) as revenue, COUNT(*) as count
      FROM \`Order\`
      WHERE status != 'cancelled' AND paymentMethod != 'gift'
      GROUP BY YEAR(createdAt)
      ORDER BY year ASC
    `,
    // Last 12 months of revenue + order count for the growth chart. Empty months
    // are not returned by the GROUP BY; the UI fills the gaps.
    prisma.$queryRaw<Array<{ ym: string; revenue: number; count: bigint }>>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as ym,
             SUM(total) as revenue,
             COUNT(*) as count
      FROM \`Order\`
      WHERE status != 'cancelled'
        AND paymentMethod != 'gift'
        AND createdAt >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY ym
      ORDER BY ym ASC
    `,
    prisma.order.aggregate({
      _count: { _all: true },
      _sum: { shippingCost: true },
      where: GIFT,
    }),
    prisma.orderItem.aggregate({
      _sum: { quantity: true },
      where: { order: GIFT },
    }),
    prisma.order.aggregate({
      _count: { _all: true },
      _sum: { total: true },
      where: CANCELLED,
    }),
    // Active buyers: distinct userId with at least one valid order in the
    // configured activity window. Repeat buyers: distinct userId with ≥2
    // valid orders ever. Total buyers: distinct userId with ≥1 valid order.
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT userId) as c
      FROM \`Order\`
      WHERE status != 'cancelled'
        AND paymentMethod != 'gift'
        AND createdAt >= ${activeSince}
    `,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) as c FROM (
        SELECT userId
        FROM \`Order\`
        WHERE status != 'cancelled' AND paymentMethod != 'gift'
        GROUP BY userId
        HAVING COUNT(*) >= 2
      ) t
    `,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT userId) as c
      FROM \`Order\`
      WHERE status != 'cancelled' AND paymentMethod != 'gift'
    `,
  ]);

  // Production batches → weighted-average unit cost per product. Used to
  // compute the "real" inventory cost instead of the old `retail × cogsRatio`
  // heuristic. Products with no batches fall back to the heuristic so the
  // headline number is never empty.
  const batchAgg = await prisma.productionBatch.groupBy({
    by: ['productId'],
    _sum: { quantity: true, totalCost: true },
  });
  const avgCostByProduct = new Map<string, number>();
  const batchUnitsByProduct = new Map<string, number>();
  for (const b of batchAgg) {
    const q = Number(b._sum.quantity ?? 0);
    const c = Number(b._sum.totalCost ?? 0);
    if (q > 0) avgCostByProduct.set(b.productId, c / q);
    batchUnitsByProduct.set(b.productId, q);
  }

  // Supplier liabilities (positive = we owe). Computed from transactions:
  // SUM(invoice) - SUM(payment+credit-note). A liability reduces baseValue
  // because anyone buying the company today inherits the debt.
  const supplierAgg = await prisma.supplierTransaction.groupBy({
    by: ['kind'],
    _sum: { amount: true },
  });
  let supplierLiabilities = 0;
  for (const r of supplierAgg) {
    const amt = Number(r._sum.amount ?? 0);
    if (r.kind === 'invoice') supplierLiabilities += amt;
    else supplierLiabilities -= amt;
  }
  // Round once at the boundary to keep the response clean.
  supplierLiabilities = Math.round(supplierLiabilities * 100) / 100;

  // Production stats for the dedicated section on the valuation page.
  const [supplierCount, activeSupplierCount, totalBatchCount, batchSpendAgg, supplierTxnCount, openingBalanceProducts] = await Promise.all([
    prisma.supplier.count(),
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.productionBatch.count(),
    prisma.productionBatch.aggregate({ _sum: { quantity: true, totalCost: true } }),
    prisma.supplierTransaction.count(),
    prisma.productionBatch.findMany({
      where: { isOpeningBalance: true },
      distinct: ['productId'],
      select: { productId: true },
    }),
  ]);
  const openingBalanceSeededCount = openingBalanceProducts.length;

  // Cost of gifted items at retail (admin discretion — these are units we
  // gave away, not sold). We use retail price as the headline opportunity-cost
  // figure; the COGS share is reflected in inventoryCost below.
  const giftItems = await prisma.orderItem.findMany({
    where: { order: GIFT },
    select: { quantity: true, unitPrice: true },
  });
  const giftItemsRetailValue = giftItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const giftUnits = Number(giftItemsAgg._sum.quantity ?? 0);
  const giftCount = giftOrders._count._all;
  const giftShipping = giftOrders._sum.shippingCost ?? 0;

  const soldMap = new Map(sold.map(s => [s.productId, Number(s._sum.quantity ?? 0)]));
  const soldLiveMap = new Map(soldLive.map(s => [s.productId, Number(s._sum?.quantity ?? 0)]));

  // Aggregate metrics
  const inventoryUnits = products.reduce((s, p) => s + p.stock, 0);
  const inventoryValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  // Inventory cost — weighted-average COGS from batches per product, with
  // a fallback to `retail × cogsRatio` for products that have never had a
  // batch recorded. The two numbers are emitted side-by-side so the user
  // can compare the heuristic against the real one.
  const inventoryCostHeuristic = inventoryValue * assumptions.cogsRatio;
  let inventoryCostFromBatches = 0;
  let productsWithBatches = 0;
  for (const p of products) {
    const avg = avgCostByProduct.get(p.id);
    if (avg !== undefined && avg > 0) {
      inventoryCostFromBatches += p.stock * avg;
      productsWithBatches++;
    } else {
      inventoryCostFromBatches += p.stock * p.price * assumptions.cogsRatio;
    }
  }
  const inventoryCost = inventoryCostFromBatches;
  const totalRevenue   = orderAgg._sum.total ?? 0;
  const totalShipping  = orderAgg._sum.shippingCost ?? 0;
  const totalDiscount  = orderAgg._sum.discount ?? 0;
  const revenueExShipping = Math.max(0, totalRevenue - totalShipping);

  const activeBuyers = Number(activeBuyersRaw[0]?.c ?? 0);
  const repeatBuyers = Number(repeatBuyersRaw[0]?.c ?? 0);
  const totalBuyers  = Number(totalBuyersRaw[0]?.c ?? 0);
  const repeatRate   = totalBuyers > 0 ? repeatBuyers / totalBuyers : 0;
  const activeRatio  = customerCount > 0 ? activeBuyers / customerCount : 0;

  // Month-over-month growth from the last 12 months (last vs prior month).
  // The SQL groups by month and only emits rows for months that had orders.
  // The chart label says "آخر 12 شهر" so we backfill empty months with zeros
  // here — otherwise a sales gap looks like the data ends. Months are listed
  // from oldest to newest so the chart reads left → right.
  const monthlyMap = new Map<string, { revenue: number; count: number }>();
  ordersByMonth.forEach(r => monthlyMap.set(r.ym, {
    revenue: Math.round(Number(r.revenue) || 0),
    count: Number(r.count),
  }));
  const monthly: Array<{ ym: string; revenue: number; count: number }> = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() - 11);
  for (let i = 0; i < 12; i++) {
    const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const hit = monthlyMap.get(ym);
    monthly.push({ ym, revenue: hit?.revenue ?? 0, count: hit?.count ?? 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const lastMonth = monthly[monthly.length - 1];
  const prevMonth = monthly[monthly.length - 2];
  const momRevenueGrowth = (lastMonth && prevMonth && prevMonth.revenue > 0)
    ? (lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue
    : null;

  // IP value (per category × multiplier from market norms — see
  // src/lib/valuation-assumptions.ts for the configurable inputs).
  const ipBookValue       = books.length * assumptions.ipBookValue;
  const ipProductValue    = products.length * assumptions.ipProductValue;
  const ipDigitalValue    = assumptions.ipDigitalValue;
  const ipTotal           = ipBookValue + ipProductValue + ipDigitalValue;

  const techValue         = assumptions.techValue;
  const customerDbValue   = Math.round(customerCount * assumptions.customerDbValue);
  // Wholesale customers and active suppliers are real assets too: a
  // wholesale buyer represents recurring bulk revenue, and an active
  // supplier represents vetted production capacity. Both are tunable
  // in /admin/valuation's assumptions editor.
  const wholesaleValue              = Math.round(wholesaleCount * assumptions.wholesaleCustomerValue);
  const supplierRelationshipsValue  = Math.round(activeSupplierCount * assumptions.supplierRelationshipValue);

  // ─────────────────────────────────────────────────────────────────
  // Financial performance — the "is the business making money?" view.
  // Real M&A starts here. We compute trailing-twelve-month (TTM)
  // revenue, prior-12-month revenue (for YoY growth), gross margin
  // from actual COGS where available, and average order value. None
  // of these change the asset-based number; they sit alongside it.
  // ─────────────────────────────────────────────────────────────────
  const ttmRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const priorYearAgg = await prisma.$queryRaw<Array<{ revenue: number }>>`
    SELECT COALESCE(SUM(total), 0) AS revenue
    FROM \`Order\`
    WHERE status != 'cancelled' AND paymentMethod != 'gift'
      AND createdAt >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)
      AND createdAt <  DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
  `;
  const priorTtmRevenue = Number(priorYearAgg[0]?.revenue ?? 0);
  const yoyRevenueGrowth = priorTtmRevenue > 0
    ? (ttmRevenue - priorTtmRevenue) / priorTtmRevenue
    : null;

  // Gross margin: TTM revenue minus weighted-avg cost per item shipped.
  // We sum (OrderItem.unitPrice × qty) − (avgCostByProduct[p] × qty)
  // across all non-gift, non-cancelled OrderItems in the TTM window.
  // Products without batches use the cogsRatio fallback for the cost
  // half — the partial-actual / partial-heuristic nature is disclosed
  // separately in the Data Quality section.
  const ttmItems = await prisma.orderItem.findMany({
    where: {
      order: { ...NON_GIFT, createdAt: { gte: new Date(Date.now() - 365 * 86400000) } },
    },
    select: { productId: true, quantity: true, unitPrice: true },
  });
  let ttmRevenueFromItems = 0;
  let ttmCogs = 0;
  for (const it of ttmItems) {
    const lineRevenue = it.unitPrice * it.quantity;
    ttmRevenueFromItems += lineRevenue;
    const avg = avgCostByProduct.get(it.productId);
    const lineCost = avg !== undefined && avg > 0
      ? avg * it.quantity
      : lineRevenue * assumptions.cogsRatio;
    ttmCogs += lineCost;
  }
  const ttmGrossProfit = ttmRevenueFromItems - ttmCogs;
  const ttmGrossMargin = ttmRevenueFromItems > 0 ? ttmGrossProfit / ttmRevenueFromItems : 0;
  const aov = orderCount > 0 ? totalRevenue / orderCount : 0;
  const discountBurn = totalRevenue + totalDiscount > 0
    ? totalDiscount / (totalRevenue + totalDiscount)
    : 0;

  // ─────────────────────────────────────────────────────────────────
  // Concentration risk — the "what if we lose our top 5 customers"
  // questions every buyer asks. Computed against full lifetime
  // non-cancelled non-gift revenue so historical imports count too.
  // ─────────────────────────────────────────────────────────────────
  const customerSpendRows = await prisma.$queryRaw<Array<{ userId: string | null; spend: number }>>`
    SELECT userId, SUM(total) AS spend
    FROM \`Order\`
    WHERE status != 'cancelled' AND paymentMethod != 'gift' AND userId IS NOT NULL
    GROUP BY userId
    ORDER BY spend DESC
    LIMIT 10
  `;
  const top10CustomerSpend = customerSpendRows.reduce((s, r) => s + Number(r.spend), 0);
  const customerConcentration = totalRevenue > 0 ? top10CustomerSpend / totalRevenue : 0;

  // Top 5 products by revenue. We use OrderItem unitPrice × qty so
  // discounts and promo prices are reflected correctly.
  const productRevenueRows = await prisma.$queryRaw<Array<{ productId: string; revenue: number }>>`
    SELECT oi.productId, SUM(oi.unitPrice * oi.quantity) AS revenue
    FROM OrderItem oi
    JOIN \`Order\` o ON o.id = oi.orderId
    WHERE o.status != 'cancelled' AND o.paymentMethod != 'gift'
    GROUP BY oi.productId
    ORDER BY revenue DESC
    LIMIT 5
  `;
  const top5ProductRevenue = productRevenueRows.reduce((s, r) => s + Number(r.revenue), 0);
  const productConcentration = totalRevenue > 0 ? top5ProductRevenue / totalRevenue : 0;

  // Currency split: % of orders by currency (matters for owners
  // dealing with USD PayPal vs EGP local).
  const currencyAgg = await prisma.order.groupBy({
    by: ['currency'],
    where: NON_GIFT,
    _count: { _all: true },
    _sum: { total: true },
  });
  const usdAgg = currencyAgg.find(c => c.currency === 'USD');
  const egpAgg = currencyAgg.find(c => c.currency === 'EGP');
  const usdRevenueShare = totalRevenue > 0
    ? Number(usdAgg?._sum.total ?? 0) / totalRevenue
    : 0;

  // Geographic concentration — top 3 governorates' share of total
  // orders. shippingAddress is JSON so we read every order and
  // tally in JS. This is bounded by the order count, which we
  // already keep paged in the existing flow.
  const orderGovs = await prisma.order.findMany({
    where: NON_GIFT,
    select: { shippingAddress: true, total: true },
    take: 5000, // cap so the report stays snappy on huge datasets
  });
  const govSpend = new Map<string, number>();
  let govSpendTotal = 0;
  for (const o of orderGovs) {
    const addr = o.shippingAddress as { governorate?: string } | null;
    const g = addr?.governorate?.trim();
    if (!g) continue;
    govSpend.set(g, (govSpend.get(g) ?? 0) + o.total);
    govSpendTotal += o.total;
  }
  const topGovs = Array.from(govSpend.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const top3GovShare = govSpendTotal > 0
    ? topGovs.reduce((s, [, v]) => s + v, 0) / govSpendTotal
    : 0;

  // Supplier concentration — top supplier's share of total batch spend.
  const supplierSpendRows = await prisma.productionBatch.groupBy({
    by: ['supplierId'],
    _sum: { totalCost: true },
  });
  const totalBatchSpend = supplierSpendRows.reduce((s, r) => s + Number(r._sum.totalCost ?? 0), 0);
  const topSupplierSpend = supplierSpendRows
    .filter(r => r.supplierId !== null)
    .sort((a, b) => Number(b._sum.totalCost ?? 0) - Number(a._sum.totalCost ?? 0))[0];
  const supplierConcentration = totalBatchSpend > 0 && topSupplierSpend
    ? Number(topSupplierSpend._sum.totalCost ?? 0) / totalBatchSpend
    : 0;

  // ─────────────────────────────────────────────────────────────────
  // Slow-mover inventory health — products with stock-on-hand that
  // haven't sold in 12 months are write-down candidates. A real buyer
  // discounts these to scrap value; an honest report flags them.
  // ─────────────────────────────────────────────────────────────────
  const lastSaleRows = await prisma.$queryRaw<Array<{ productId: string; lastAt: Date | null }>>`
    SELECT oi.productId AS productId, MAX(o.createdAt) AS lastAt
    FROM OrderItem oi
    JOIN \`Order\` o ON o.id = oi.orderId
    WHERE o.status != 'cancelled'
    GROUP BY oi.productId
  `;
  const lastSaleMap = new Map<string, Date | null>(
    lastSaleRows.map(r => [r.productId, r.lastAt ? new Date(r.lastAt) : null])
  );
  const STALE_DAYS = 365;
  const staleCutoff = Date.now() - STALE_DAYS * 86400000;
  let staleProductCount = 0;
  let staleUnits = 0;
  let staleInventoryCost = 0;
  let staleInventoryRetail = 0;
  for (const p of products) {
    if (p.stock <= 0) continue;
    const lastAt = lastSaleMap.get(p.id);
    const isStale = !lastAt || lastAt.getTime() < staleCutoff;
    if (!isStale) continue;
    staleProductCount++;
    staleUnits += p.stock;
    staleInventoryRetail += p.stock * p.price;
    const avg = avgCostByProduct.get(p.id);
    staleInventoryCost += avg !== undefined && avg > 0
      ? p.stock * avg
      : p.stock * p.price * assumptions.cogsRatio;
  }
  const inventoryCostAfterWriteDown = Math.max(0, inventoryCost - staleInventoryCost);

  // ─────────────────────────────────────────────────────────────────
  // Per-supplier concentration matrix — the top suppliers by total
  // batch spend, with their % share. Surfaces "if we lose Supplier X
  // we lose Y% of our production capacity."
  // ─────────────────────────────────────────────────────────────────
  const supplierIds = supplierSpendRows
    .map(r => r.supplierId)
    .filter((id): id is string => !!id);
  const supplierNameRows = supplierIds.length > 0
    ? await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true },
      })
    : [];
  const supplierNameMap = new Map(supplierNameRows.map(s => [s.id, s.name]));
  const supplierMatrix = supplierSpendRows
    .filter(r => r.supplierId !== null)
    .map(r => ({
      supplierId: r.supplierId as string,
      supplierName: supplierNameMap.get(r.supplierId as string) ?? '— غير معروف —',
      spend: Math.round(Number(r._sum.totalCost ?? 0)),
      share: totalBatchSpend > 0 ? Number(r._sum.totalCost ?? 0) / totalBatchSpend : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  // ─────────────────────────────────────────────────────────────────
  // Data quality counters — surfaces what's heuristic vs. data-driven
  // so the reader can calibrate confidence. Numbers feed into the
  // Disclosures section on the page.
  // ─────────────────────────────────────────────────────────────────
  const bostaOrphanCount = await prisma.order.count({
    where: { paymentMethod: 'bosta-historical', items: { none: {} } },
  });
  const productsWithoutBatches = products.length - productsWithBatches;
  const assumptionsRow = await prisma.setting.findUnique({ where: { key: 'valuation-assumptions' } });
  const assumptionsUpdatedAt = assumptionsRow?.updatedAt?.toISOString() ?? null;

  // Final valuation buckets
  // Customer receivables — outstanding balances wholesale dealers (or
  // retail credit cases) owe us. Real assets that any buyer inherits.
  const customerReceivables = await totalReceivables();

  // Supplier liabilities are deducted because any buyer of the company
  // inherits the debt; surfacing it here keeps the headline honest.
  // Receivables work the opposite way — they ADD to baseValue.
  const baseValue        = inventoryCost + ipTotal + techValue + customerDbValue
                         + wholesaleValue + supplierRelationshipsValue
                         + customerReceivables
                         - Math.max(0, supplierLiabilities);
  const fairValue        = baseValue * assumptions.fairMultiplier;
  const strategicValue   = baseValue * assumptions.strategicMultiplier;

  // Market-approach valuation band — TTM revenue × industry-typical
  // multiplier. Range allows the reader to see the spread between a
  // commodity (low end) and a high-growth/high-margin (high end)
  // valuation. Reported alongside, NOT replacing, the asset-based
  // number — the reader picks based on context.
  const marketLow  = Math.round(ttmRevenue * assumptions.revenueMultipleLow);
  const marketHigh = Math.round(ttmRevenue * assumptions.revenueMultipleHigh);
  // Reconciled range = union of asset-based floor and market-approach
  // band. The midpoint is what we suggest as the "headline" estimate.
  const reconciledLow  = Math.min(baseValue, marketLow);
  const reconciledHigh = Math.max(strategicValue, marketHigh);
  const reconciledMid  = (reconciledLow + reconciledHigh) / 2;

  // ─────────────────────────────────────────────────────────────────
  // Sensitivity analysis — how does the headline midpoint change
  // under common stresses? A real M&A report shows this so the buyer
  // can see where the number is fragile.
  // ─────────────────────────────────────────────────────────────────
  const recomputeBase = (overrides: { extraCogs?: number; extraSupplierLiabilities?: number }) => {
    const inv = inventoryCost + (overrides.extraCogs ?? 0);
    const liab = supplierLiabilities + (overrides.extraSupplierLiabilities ?? 0);
    return inv + ipTotal + techValue + customerDbValue
         + wholesaleValue + supplierRelationshipsValue
         - Math.max(0, liab);
  };
  const stressBaseCogsUp  = recomputeBase({ extraCogs: inventoryValue * 0.05 });
  const stressBaseCogsDown = recomputeBase({ extraCogs: -inventoryValue * 0.05 });
  // Top-10 customer churn: simulate losing top-10 customers' lifetime
  // revenue contribution. We translate it to a market-multiple impact
  // (we don't have ARR; this is a one-time revenue hit proxy).
  const ttmCustomerLoss = ttmRevenue * customerConcentration; // assume top-10 share is recurring
  const stressMarketLow_loss  = Math.max(0, (ttmRevenue - ttmCustomerLoss)) * assumptions.revenueMultipleLow;
  const stressMarketHigh_loss = Math.max(0, (ttmRevenue - ttmCustomerLoss)) * assumptions.revenueMultipleHigh;
  // Currency stress: 10% EGP devaluation against USD shrinks the EGP
  // value of USD revenue. Approximate the impact as "10% of USD share".
  const usdShareImpact = ttmRevenue * usdRevenueShare * 0.10;
  // Stale inventory write-down: full hit on the asset side.
  const stressBaseStaleWriteDown = baseValue - staleInventoryCost;
  const sensitivity = {
    cogsUp5pct:   { delta: Math.round(stressBaseCogsUp - baseValue),   newBase: Math.round(stressBaseCogsUp) },
    cogsDown5pct: { delta: Math.round(stressBaseCogsDown - baseValue), newBase: Math.round(stressBaseCogsDown) },
    multipleDown05x: {
      delta: Math.round(ttmRevenue * (assumptions.revenueMultipleHigh - 0.5) - marketHigh),
      newMarketHigh: Math.round(ttmRevenue * Math.max(0, assumptions.revenueMultipleHigh - 0.5)),
    },
    top10ChurnLoss: {
      revenueLost: Math.round(ttmCustomerLoss),
      newMarketLow:  Math.round(stressMarketLow_loss),
      newMarketHigh: Math.round(stressMarketHigh_loss),
    },
    usdDevaluation10pct: {
      revenueImpact: Math.round(usdShareImpact),
      newMarketHigh: Math.round((ttmRevenue - usdShareImpact) * assumptions.revenueMultipleHigh),
    },
    staleWriteDown: {
      delta: Math.round(stressBaseStaleWriteDown - baseValue),
      newBase: Math.round(stressBaseStaleWriteDown),
      itemsAffected: staleProductCount,
    },
  };

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    assumptions,
    defaults: DEFAULT_VALUATION_ASSUMPTIONS,
    metrics: {
      products: {
        total: products.length,
        inStockCount: products.filter(p => p.stock > 0).length,
        outOfStockCount: products.filter(p => p.stock <= 0).length,
        inventoryUnits,
        inventoryValueRetail: Math.round(inventoryValue),
        inventoryValueCost: Math.round(inventoryCost),
        inventoryValueCostFromBatches: Math.round(inventoryCostFromBatches),
        inventoryValueCostHeuristic: Math.round(inventoryCostHeuristic),
        productsWithBatches,
        productsWithoutBatches: products.length - productsWithBatches,
        productsOpeningBalanceSeeded: openingBalanceSeededCount,
      },
      books: {
        total: books.length,
        published: books.filter(b => b.isPublished).length,
        languages: Array.from(new Set(books.map(b => b.language).filter(Boolean))),
      },
      sales: {
        totalOrders: orderCount,
        validOrders: validOrderCount,
        cancelledOrders: cancelledAgg._count._all,
        cancelledRevenue: Math.round(cancelledAgg._sum.total ?? 0),
        totalRevenue: Math.round(totalRevenue),
        totalShipping: Math.round(totalShipping),
        totalDiscount: Math.round(totalDiscount),
        revenueExShipping: Math.round(revenueExShipping),
        avgOrderValue: validOrderCount ? Math.round(totalRevenue / validOrderCount) : 0,
        avgOrderValueExShipping: validOrderCount ? Math.round(revenueExShipping / validOrderCount) : 0,
        unitsSold: Array.from(soldMap.values()).reduce((s, n) => s + n, 0),
        unitsSoldLive: Array.from(soldLiveMap.values()).reduce((s, n) => s + n, 0),
        byYear: ordersByYear.map(r => ({
          year: r.year,
          revenue: Math.round(Number(r.revenue) || 0),
          count: Number(r.count),
        })),
        byMonth: monthly,
        momRevenueGrowth,
      },
      customers: {
        total: customerCount,
        wholesale: wholesaleCount,
        buyers: totalBuyers,
        active: activeBuyers,
        activeWindowDays: assumptions.activeWindowDays,
        activeRatio,
        repeatBuyers,
        repeatRate,
        avgRevenuePerBuyer: totalBuyers > 0 ? Math.round(totalRevenue / totalBuyers) : 0,
      },
      shipments: shipmentCount,
      production: {
        batchesCount: totalBatchCount,
        unitsProduced: Number(batchSpendAgg._sum.quantity ?? 0),
        totalSpend: Math.round(Number(batchSpendAgg._sum.totalCost ?? 0)),
      },
      suppliers: {
        total: supplierCount,
        active: activeSupplierCount,
        transactionCount: supplierTxnCount,
        // Positive = we owe them (a company-buyer would inherit it).
        // Negative = they owe us (small upside, ignored from baseValue).
        netLiabilities: supplierLiabilities,
      },
      gifts: {
        count: giftCount,
        units: giftUnits,
        retailValue: Math.round(giftItemsRetailValue),
        shippingCost: Math.round(giftShipping),
        totalCost: Math.round(giftItemsRetailValue + giftShipping),
      },
      ip: {
        booksValue: ipBookValue,
        productsValue: ipProductValue,
        digitalValue: ipDigitalValue,
        total: ipTotal,
        // Surface the per-unit weights so the UI can show the methodology
        // alongside the headline number.
        perBook: assumptions.ipBookValue,
        perProduct: assumptions.ipProductValue,
        booksCount: books.length,
        productsCount: products.length,
      },
      tech: { value: techValue },
      customerDb: { value: customerDbValue, perCustomer: assumptions.customerDbValue },
      wholesale: { value: wholesaleValue, perCustomer: assumptions.wholesaleCustomerValue, count: wholesaleCount },
      supplierRelationships: { value: supplierRelationshipsValue, perSupplier: assumptions.supplierRelationshipValue, count: activeSupplierCount },
      customerReceivables: { value: Math.round(customerReceivables) },
      // Trailing-twelve-month (TTM) financial performance — revenue,
      // gross margin, AOV, growth. The single most important section
      // for any real M&A conversation.
      financial: {
        ttmRevenue: Math.round(ttmRevenue),
        priorTtmRevenue: Math.round(priorTtmRevenue),
        yoyRevenueGrowth, // null when no prior-year baseline
        grossProfit: Math.round(ttmGrossProfit),
        grossMargin: ttmGrossMargin,
        aov: Math.round(aov),
        discountBurn,
        // Disclosure: what fraction of COGS came from real batches vs
        // the cogsRatio fallback. The page surfaces this so readers
        // know how solid the gross margin number is.
        productsCostedFromBatches: productsWithBatches,
        productsCostedFromHeuristic: productsWithoutBatches,
      },
      // Concentration risk — the "what if we lose our top 5
      // customers" questions every buyer asks first.
      concentration: {
        top10CustomersRevenueShare: customerConcentration,
        top5ProductsRevenueShare: productConcentration,
        top3GovernoratesShare: top3GovShare,
        topGovernorates: topGovs.map(([name, spend]) => ({ name, spend: Math.round(spend) })),
        usdRevenueShare,
        topSupplierShare: supplierConcentration,
      },
      // Inventory health: products that haven't sold in 12 months
      // are write-down candidates. Helps the buyer adjust for slow
      // movers / obsolete stock.
      inventoryHealth: {
        staleProductCount,
        staleUnits,
        staleInventoryRetail: Math.round(staleInventoryRetail),
        staleInventoryCost: Math.round(staleInventoryCost),
        inventoryCostBeforeWriteDown: Math.round(inventoryCost),
        inventoryCostAfterWriteDown: Math.round(inventoryCostAfterWriteDown),
        staleDaysThreshold: STALE_DAYS,
      },
      // Per-supplier matrix: top 5 by spend with shares.
      supplierMatrix,
      // Sensitivity scenarios: shows the buyer where the number is
      // fragile under common stresses (COGS up, multiple down,
      // customer churn, currency move, slow-mover write-off).
      sensitivity,
      // Data quality flags — every gap the reader should weigh against
      // the headline figure. Surfaced as an explicit Disclosures
      // section on the page.
      dataQuality: {
        productsCostedFromBatches: productsWithBatches,
        productsCostedFromHeuristic: productsWithoutBatches,
        bostaOrphanCount,
        opexTracked: false,
        assumptionsUpdatedAt,
      },
    },
    valuation: {
      base: Math.round(baseValue),
      fair: Math.round(fairValue),
      strategic: Math.round(strategicValue),
      // Expose the multipliers so the UI can show them next to each scenario.
      fairMultiplier: assumptions.fairMultiplier,
      strategicMultiplier: assumptions.strategicMultiplier,
      // Market approach (revenue × industry multiple).
      marketLow,
      marketHigh,
      revenueMultipleLow: assumptions.revenueMultipleLow,
      revenueMultipleHigh: assumptions.revenueMultipleHigh,
      // Reconciled "professional" valuation range.
      reconciledLow: Math.round(reconciledLow),
      reconciledHigh: Math.round(reconciledHigh),
      reconciledMid: Math.round(reconciledMid),
    },
    products: products.map(p => ({
      ...p,
      sold: soldMap.get(p.id) ?? 0,
      soldLive: soldLiveMap.get(p.id) ?? 0,
      productionBatchUnits: batchUnitsByProduct.get(p.id) ?? 0,
      stockValue: Math.round(p.stock * p.price),
    })),
    books,
  });
}

// PUT /api/admin/valuation — update tunable assumptions. Same auth gate
// as GET. Body is a partial ValuationAssumptions object; unknown fields
// are dropped and out-of-range values are clamped to the legal interval
// (the caller is told which fields were adjusted).
export async function PUT(req: NextRequest) {
  const guard = await requirePerm('valuation.write');
  if ('response' in guard) return guard.response;

  let body: Partial<ValuationAssumptions>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 });
  }

  // Snapshot the previous assumptions so the audit log can record a diff.
  const before = await getValuationAssumptions();
  const { saved, rejected, clamped } = await saveValuationAssumptions(body || {});

  await logActionSafe({
    actor: guard.user,
    action: 'valuation.assumptions-update',
    entity: 'Setting',
    entityId: 'valuation-assumptions',
    before,
    after: saved,
    metadata: { rejected, clamped },
  });

  return NextResponse.json({ ok: true, assumptions: saved, rejected, clamped });
}
