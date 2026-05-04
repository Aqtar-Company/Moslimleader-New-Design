export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/admin/valuation — live company valuation report.
// Password-gated via header `x-valuation-password`. Default password is
// 'Ibrahim@1987'; can be overridden by env VALUATION_PASSWORD.
export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const expected = process.env.VALUATION_PASSWORD || 'Ibrahim@1987';
  const provided = req.headers.get('x-valuation-password') || new URL(req.url).searchParams.get('password') || '';
  if (provided !== expected) {
    return NextResponse.json({ error: 'كلمة السر غير صحيحة' }, { status: 401 });
  }

  // Pull live data
  const [products, books, orderAgg, orderCount, validOrderCount, customerCount, shipmentCount, sold, ordersByYear] = await Promise.all([
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
      _sum: { total: true },
      where: { status: { not: 'cancelled' } },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { not: 'cancelled' } } }),
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.shipment.count(),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: { not: 'cancelled' } } },
      _sum: { quantity: true },
    }),
    prisma.$queryRaw<Array<{ year: number; revenue: number; count: bigint }>>`
      SELECT YEAR(createdAt) as year, SUM(total) as revenue, COUNT(*) as count
      FROM \`Order\`
      WHERE status != 'cancelled'
      GROUP BY YEAR(createdAt)
      ORDER BY year ASC
    `,
  ]);

  const soldMap = new Map(sold.map(s => [s.productId, Number(s._sum.quantity ?? 0)]));

  // Aggregate metrics
  const inventoryUnits = products.reduce((s, p) => s + p.stock, 0);
  const inventoryValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  const inventoryCost  = inventoryValue * 0.35;     // assumed 35% COGS
  const totalRevenue   = orderAgg._sum.total ?? 0;

  // IP value (per category × multiplier from market norms)
  const ipBookValue       = books.length * 120000;        // ~120K per authored book
  const ipProductValue    = products.length * 40000;      // ~40K per authored product
  const ipDigitalValue    = 350000;                       // YouTube + PDFs + brand
  const ipTotal           = ipBookValue + ipProductValue + ipDigitalValue;

  const techValue         = 800000;       // platform + admin + integrations
  const customerDbValue   = Math.round(customerCount * 200); // ~200 EGP per customer

  // Final valuation buckets
  const baseValue        = inventoryCost + ipTotal + techValue + customerDbValue;
  const fairValue        = baseValue * 1.25;
  const strategicValue   = baseValue * 1.55;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
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
        cancelledOrders: orderCount - validOrderCount,
        totalRevenue: Math.round(totalRevenue),
        avgOrderValue: validOrderCount ? Math.round(totalRevenue / validOrderCount) : 0,
        unitsSold: Array.from(soldMap.values()).reduce((s, n) => s + n, 0),
        byYear: ordersByYear.map(r => ({
          year: r.year,
          revenue: Math.round(Number(r.revenue) || 0),
          count: Number(r.count),
        })),
      },
      customers: customerCount,
      shipments: shipmentCount,
      ip: {
        booksValue: ipBookValue,
        productsValue: ipProductValue,
        digitalValue: ipDigitalValue,
        total: ipTotal,
      },
      tech: { value: techValue },
      customerDb: { value: customerDbValue },
    },
    valuation: {
      base: Math.round(baseValue),
      fair: Math.round(fairValue),
      strategic: Math.round(strategicValue),
    },
    products: products.map(p => ({
      ...p,
      sold: soldMap.get(p.id) ?? 0,
      stockValue: Math.round(p.stock * p.price),
    })),
    books,
  });
}
