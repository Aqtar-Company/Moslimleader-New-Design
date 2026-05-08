export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import type { CustomerSummary } from '@/lib/customers-cache';
import { getCustomersCache, setCustomersCache, invalidateCustomersCache } from '@/lib/customers-cache';
import { IMPORT_SOURCES, IMPORT_PAYMENT_METHODS } from '@/lib/order-filters';

interface ShippingAddr {
  governorate?: string;
  city?: string;
  region?: string;
  country?: string;
  phone?: string;
}

// The cache itself lives in src/lib/customers-cache.ts so a sibling route
// (the wholesale-toggle PATCH at /api/admin/customers/[id]) can invalidate
// it without exporting non-handler functions from this route module.

async function aggregate(): Promise<{ list: CustomerSummary[]; totalProducts: number }> {
  const cached = getCustomersCache();
  if (cached) return cached;

  const orders = await prisma.order.findMany({
    where: { status: { not: 'cancelled' } },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, createdAt: true, marketingOptIn: true, isWholesale: true } },
      items: { select: { productId: true, productName: true, quantity: true, unitPrice: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const map = new Map<string, CustomerSummary & { _productIds: Set<string>; _hasImport: boolean; _hasLive: boolean }>();
  for (const o of orders) {
    const u = o.user;
    if (!u) continue;
    let row = map.get(u.id);
    if (!row) {
      row = {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        marketingOptIn: u.marketingOptIn,
        isWholesale: u.isWholesale,
        createdAt: u.createdAt.toISOString(),
        orderCount: 0,
        totalSpend: 0,
        avgOrder: 0,
        lastOrderAt: null,
        firstOrderAt: null,
        daysSinceLastOrder: null,
        productIds: [],
        _productIds: new Set<string>(),
        _hasImport: false,
        _hasLive: false,
        lastGovernorate: null,
        segments: [],
      };
      map.set(u.id, row);
    }
    row.orderCount += 1;
    row.totalSpend += o.total;
    // Tag the order as import vs live so we can derive the "converted"
    // segment (a customer who appears in BOTH sources is the warmest
    // re-engagement target — they already trust us across two channels).
    const isImport = (o.source !== null && (IMPORT_SOURCES as readonly string[]).includes(o.source))
                  || (IMPORT_PAYMENT_METHODS as readonly string[]).includes(o.paymentMethod);
    if (isImport) row._hasImport = true;
    else if (o.paymentMethod !== 'gift') row._hasLive = true;
    const orderTime = o.createdAt.toISOString();
    const addr = o.shippingAddress as unknown as ShippingAddr;
    if (!row.lastOrderAt || orderTime > row.lastOrderAt) {
      row.lastOrderAt = orderTime;
      if (!row.phone && addr?.phone) row.phone = addr.phone;
    }
    if (!row.lastGovernorate && addr?.governorate) {
      row.lastGovernorate = addr.governorate;
    }
    if (!row.firstOrderAt || orderTime < row.firstOrderAt) {
      row.firstOrderAt = orderTime;
    }
    for (const it of o.items) row._productIds.add(it.productId);
  }

  const totalPublishedProducts = await prisma.product.count({ where: { inStock: true } });

  const now = Date.now();
  const list: CustomerSummary[] = [];
  for (const [, row] of map) {
    row.productIds = Array.from(row._productIds);
    row.avgOrder = row.orderCount ? Math.round((row.totalSpend / row.orderCount) * 100) / 100 : 0;
    row.daysSinceLastOrder = row.lastOrderAt
      ? Math.floor((now - new Date(row.lastOrderAt).getTime()) / 86400000)
      : null;

    const segments: string[] = [];
    if (row.orderCount === 1) segments.push('single');
    if (row.orderCount >= 2) segments.push('repeat');
    if (row.daysSinceLastOrder !== null && row.daysSinceLastOrder > 90) segments.push('dormant');
    if (row.daysSinceLastOrder !== null && row.daysSinceLastOrder <= 90) segments.push('active');
    if (row.isWholesale) segments.push('wholesale');
    if (totalPublishedProducts > 0 && row.productIds.length >= totalPublishedProducts) {
      segments.push('bought_all');
    }
    // Imported→live converters: customers who appeared in the historical
    // imports AND came back through the live system. Highest-intent
    // re-engagement audience.
    if (row._hasImport && row._hasLive) segments.push('converted');
    row.segments = segments;
    const rowAny = row as Partial<typeof row & { _productIds?: unknown; _hasImport?: unknown; _hasLive?: unknown }>;
    delete rowAny._productIds;
    delete rowAny._hasImport;
    delete rowAny._hasLive;
    list.push(row);
  }

  // VIP = top 10% by spend
  const sortedBySpend = [...list].sort((a, b) => b.totalSpend - a.totalSpend);
  const vipCount = Math.max(1, Math.ceil(sortedBySpend.length * 0.1));
  const vipIds = new Set(sortedBySpend.slice(0, vipCount).map(r => r.id));
  for (const r of list) if (vipIds.has(r.id)) r.segments.push('vip');

  const next = { at: Date.now(), list, totalProducts: totalPublishedProducts };
  setCustomersCache(next);
  return next;
}

// GET /api/admin/customers — aggregated customers with segment filters + pagination
export async function GET(req: NextRequest) {
  const guard = await requirePerm('customers.read');
  if ('response' in guard) {
    // Preserve the request-level interface (return JSON 403 instead of NextResponse).
    return guard.response;
  }

  const url = new URL(req.url);
  const segment = url.searchParams.get('segment') || 'all';
  const productFilter = url.searchParams.get('boughtProduct');
  const notProductFilter = url.searchParams.get('notBoughtProduct');
  const govFilter = url.searchParams.get('governorate');
  const search = (url.searchParams.get('q') || '').trim().toLowerCase();
  const sort = url.searchParams.get('sort') || 'spend';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 5000);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
  const refresh = url.searchParams.get('refresh') === '1';
  if (refresh) invalidateCustomersCache();

  const { list, totalProducts } = await aggregate();

  // Apply filters
  let filtered = list;
  if (segment && segment !== 'all') {
    filtered = filtered.filter(r => r.segments.includes(segment));
  }
  if (productFilter) {
    filtered = filtered.filter(r => r.productIds.includes(productFilter));
  }
  if (notProductFilter) {
    filtered = filtered.filter(r => !r.productIds.includes(notProductFilter));
  }
  if (govFilter) {
    filtered = filtered.filter(r => r.lastGovernorate === govFilter);
  }
  if (search) {
    filtered = filtered.filter(r =>
      r.name.toLowerCase().includes(search) ||
      r.email.toLowerCase().includes(search) ||
      (r.phone || '').toLowerCase().includes(search),
    );
  }

  // Segment counts for the chips (computed on the *unfiltered* list so chips
  // always show the true universe size).
  const counts: Record<string, number> = { all: list.length };
  for (const r of list) for (const s of r.segments) counts[s] = (counts[s] || 0) + 1;

  // Sort then paginate
  if (sort === 'recent') filtered.sort((a, b) => (b.lastOrderAt || '').localeCompare(a.lastOrderAt || ''));
  else if (sort === 'orders') filtered.sort((a, b) => b.orderCount - a.orderCount);
  else filtered.sort((a, b) => b.totalSpend - a.totalSpend);

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  return NextResponse.json({ customers: page, counts, totalProducts, total });
}
