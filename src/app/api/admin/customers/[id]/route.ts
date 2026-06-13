export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { invalidateCustomersCache } from '@/lib/customers-cache';

interface ShippingAddr {
  firstName?: string; lastName?: string; phone?: string; whatsappNumber?: string;
  street?: string; building?: string; city?: string; region?: string;
  governorate?: string; country?: string;
}

// GET /api/admin/customers/[id] — full customer 360
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('customers.read');
  if ('response' in guard) return guard.response;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, createdAt: true,
      savedAddresses: true, isWholesale: true,
      children: { select: { id: true, name: true, birthdate: true, gender: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!user) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });

  const orders = await prisma.order.findMany({
    where: { userId: id },
    include: { items: true, shipment: true },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregate: per-product counts & spend
  const productAgg = new Map<string, { productId: string; name: string; quantity: number; spend: number; lastBoughtAt: string }>();
  let totalSpend = 0;
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    totalSpend += o.total;
    for (const it of o.items) {
      const existing = productAgg.get(it.productId);
      const orderTime = o.createdAt.toISOString();
      if (existing) {
        existing.quantity += it.quantity;
        existing.spend += it.unitPrice * it.quantity;
        if (orderTime > existing.lastBoughtAt) existing.lastBoughtAt = orderTime;
      } else {
        productAgg.set(it.productId, {
          productId: it.productId,
          name: it.productName,
          quantity: it.quantity,
          spend: it.unitPrice * it.quantity,
          lastBoughtAt: orderTime,
        });
      }
    }
  }

  const boughtProductIds = new Set(productAgg.keys());
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, slug: true, price: true, images: true },
  });
  const notBought = allProducts.filter(p => !boughtProductIds.has(p.id));
  const bought = Array.from(productAgg.values()).sort((a, b) => b.spend - a.spend);

  const lastOrder = orders[0];
  const lastAddr = lastOrder ? (lastOrder.shippingAddress as unknown as ShippingAddr) : null;

  const validOrders = orders.filter(o => o.status !== 'cancelled');
  const orderCount = validOrders.length;
  const avgOrder = orderCount ? Math.round((totalSpend / orderCount) * 100) / 100 : 0;
  const lastOrderAt = lastOrder?.createdAt.toISOString() ?? null;
  const daysSinceLast = lastOrderAt
    ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / 86400000)
    : null;

  return NextResponse.json({
    customer: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      lastAddr,
      lastGovernorate: lastAddr?.governorate || null,
      children: user.children.map(c => ({ ...c, birthdate: c.birthdate.toISOString() })),
    },
    metrics: {
      totalSpend: Math.round(totalSpend * 100) / 100,
      orderCount,
      avgOrder,
      lastOrderAt,
      daysSinceLast,
      productsBought: bought.length,
      productsTotal: allProducts.length,
    },
    bought,
    notBought,
    orders: orders.map(o => ({
      id: o.id,
      status: o.status,
      total: o.total,
      currency: o.currency,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt.toISOString(),
      itemCount: o.items.reduce((s, it) => s + it.quantity, 0),
      tracking: o.shipment?.trackingNumber ?? null,
      shipmentStatus: o.shipment?.status ?? null,
    })),
  });
}

// PATCH /api/admin/customers/[id] — toggle metadata flags on a customer.
// Currently exposes only `isWholesale`; extend with care — full edits go
// through the more general customer-edit flow elsewhere.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('customers.write');
  if ('response' in guard) return guard.response;

  const { id } = await params;
  let body: { isWholesale?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const data: { isWholesale?: boolean } = {};
  if (typeof body.isWholesale === 'boolean') data.isWholesale = body.isWholesale;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'لا يوجد تعديل' }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id }, select: { id: true, isWholesale: true } });
  if (!before) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });

  const updated = await prisma.user.update({ where: { id }, data, select: { id: true, isWholesale: true } });
  invalidateCustomersCache();
  await logActionSafe({
    actor: guard.user, action: 'customer.update', entity: 'User', entityId: id,
    before, after: updated,
  });
  return NextResponse.json({ ok: true, user: updated });
}
