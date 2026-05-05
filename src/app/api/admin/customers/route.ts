export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  totalSpend: number;
  avgOrder: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  daysSinceLastOrder: number | null;
  productIds: string[];
  lastGovernorate: string | null;
  segments: string[];
}

interface ShippingAddr {
  governorate?: string;
  city?: string;
  region?: string;
  country?: string;
  phone?: string;
}

// Module-level cache so paginated re-fetches don't re-aggregate every time.
// 5-minute TTL is plenty for an admin browsing customers; a fresh import or
// new order shows up on next refresh.
interface AggregatedCache { at: number; list: CustomerSummary[]; totalProducts: number }
let aggCache: AggregatedCache | null = null;
const AGG_TTL_MS = 5 * 60 * 1000;

async function aggregate(): Promise<AggregatedCache> {
  if (aggCache && Date.now() - aggCache.at < AGG_TTL_MS) return aggCache;

  const orders = await prisma.order.findMany({
    where: { status: { not: 'cancelled' } },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      items: { select: { productId: true, productName: true, quantity: true, unitPrice: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const map = new Map<string, CustomerSummary & { _productIds: Set<string> }>();
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
        createdAt: u.createdAt.toISOString(),
        orderCount: 0,
        totalSpend: 0,
        avgOrder: 0,
        lastOrderAt: null,
        firstOrderAt: null,
        daysSinceLastOrder: null,
        productIds: [],
        _productIds: new Set<string>(),
        lastGovernorate: null,
        segments: [],
      };
      map.set(u.id, row);
    }
    row.orderCount += 1;
    row.totalSpend += o.total;
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
    if (totalPublishedProducts > 0 && row.productIds.length >= totalPublishedProducts) {
      segments.push('bought_all');
    }
    row.segments = segments;
    delete (row as Partial<typeof row & { _productIds?: unknown }>)._productIds;
    list.push(row);
  }

  // VIP = top 10% by spend
  const sortedBySpend = [...list].sort((a, b) => b.totalSpend - a.totalSpend);
  const vipCount = Math.max(1, Math.ceil(sortedBySpend.length * 0.1));
  const vipIds = new Set(sortedBySpend.slice(0, vipCount).map(r => r.id));
  for (const r of list) if (vipIds.has(r.id)) r.segments.push('vip');

  aggCache = { at: Date.now(), list, totalProducts: totalPublishedProducts };
  return aggCache;
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
  if (refresh) aggCache = null;

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
