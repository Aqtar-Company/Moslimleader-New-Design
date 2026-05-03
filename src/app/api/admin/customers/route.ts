export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

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

// GET /api/admin/customers — aggregated customers with segment filters
export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const url = new URL(req.url);
  const segment = url.searchParams.get('segment') || 'all';
  const productFilter = url.searchParams.get('boughtProduct');
  const notProductFilter = url.searchParams.get('notBoughtProduct');
  const govFilter = url.searchParams.get('governorate');
  const search = (url.searchParams.get('q') || '').trim().toLowerCase();
  const sort = url.searchParams.get('sort') || 'spend';

  // Pull every order with items + user; aggregate in memory. Customer set is
  // small enough on this site that one pass is fine and avoids N+1.
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
    // Orders arrive newest-first; remember the first non-null governorate we
    // see so a missing field on the latest order falls back to the previous one.
    if (!row.lastGovernorate && addr?.governorate) {
      row.lastGovernorate = addr.governorate;
    }
    if (!row.firstOrderAt || orderTime < row.firstOrderAt) {
      row.firstOrderAt = orderTime;
    }
    for (const it of o.items) row._productIds.add(it.productId);
  }

  // Denominator for bought_all should be products visible on the storefront
  // — ignore static-source shadow rows seeded by the cart and out-of-stock
  // items so the segment is actually achievable.
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

  // Segment counts for the chips (computed before pagination, on the full list)
  const counts: Record<string, number> = { all: list.length };
  for (const r of list) for (const s of r.segments) counts[s] = (counts[s] || 0) + 1;

  // Sort
  if (sort === 'recent') filtered.sort((a, b) => (b.lastOrderAt || '').localeCompare(a.lastOrderAt || ''));
  else if (sort === 'orders') filtered.sort((a, b) => b.orderCount - a.orderCount);
  else filtered.sort((a, b) => b.totalSpend - a.totalSpend);

  return NextResponse.json({ customers: filtered, counts, totalProducts: totalPublishedProducts });
}
