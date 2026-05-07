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

// Password gate that protects both GET and PUT. The page asks for the
// password once and replays it on every request via x-valuation-password.
// Fail-closed: if VALUATION_PASSWORD isn't configured we refuse rather than
// fall back to an in-repo default. The previous fallback was a real secret
// in plaintext and effectively neutralised the password gate.
function checkPassword(req: NextRequest): NextResponse | null {
  const expected = process.env.VALUATION_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'VALUATION_PASSWORD غير مضبوطة في إعدادات الخادم' }, { status: 500 });
  }
  const provided = req.headers.get('x-valuation-password') || new URL(req.url).searchParams.get('password') || '';
  if (provided !== expected) {
    return NextResponse.json({ error: 'كلمة السر غير صحيحة' }, { status: 401 });
  }
  return null;
}

// GET /api/admin/valuation — live company valuation report.
// Requires `valuation.read` permission, then password-gated.
export async function GET(req: NextRequest) {
  const guard = await requirePerm('valuation.read');
  if ('response' in guard) return guard.response;
  const pw = checkPassword(req);
  if (pw) return pw;

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
    customerCount, shipmentCount,
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
  const inventoryCost  = inventoryValue * assumptions.cogsRatio;
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

  // Final valuation buckets
  const baseValue        = inventoryCost + ipTotal + techValue + customerDbValue;
  const fairValue        = baseValue * assumptions.fairMultiplier;
  const strategicValue   = baseValue * assumptions.strategicMultiplier;

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
        buyers: totalBuyers,
        active: activeBuyers,
        activeWindowDays: assumptions.activeWindowDays,
        activeRatio,
        repeatBuyers,
        repeatRate,
        avgRevenuePerBuyer: totalBuyers > 0 ? Math.round(totalRevenue / totalBuyers) : 0,
      },
      shipments: shipmentCount,
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
    },
    valuation: {
      base: Math.round(baseValue),
      fair: Math.round(fairValue),
      strategic: Math.round(strategicValue),
      // Expose the multipliers so the UI can show them next to each scenario.
      fairMultiplier: assumptions.fairMultiplier,
      strategicMultiplier: assumptions.strategicMultiplier,
    },
    products: products.map(p => ({
      ...p,
      sold: soldMap.get(p.id) ?? 0,
      soldLive: soldLiveMap.get(p.id) ?? 0,
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
  const pw = checkPassword(req);
  if (pw) return pw;

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
