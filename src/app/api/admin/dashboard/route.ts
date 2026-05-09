export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserWithPerms } from '@/lib/permissions';
import { normalizeStatus } from '@/lib/admin-status';

// Dashboard endpoint — returns ONLY the small aggregates the home page
// needs. Replaces the previous pattern of fetching /api/admin/orders,
// /api/admin/users, /api/admin/coupons, /api/admin/products?lite=true
// (each loading hundreds of rows just to count them in JS).
//
// Admin-like (admin or staff) is enough — every count is harmless on
// its own. Staff who lack a particular perm just see the same numbers
// the home page used to show; nothing here exposes detail beyond
// counts + the 6 most recent orders' headers.
export async function GET() {
  const user = await getAuthUserWithPerms();
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Gate per-permission so staff without coupons.read / customers
  // visibility don't see counts they can't access from elsewhere.
  // Super-admins see everything.
  const isSuperAdmin = user.role === 'admin';
  const canSeeCustomers = isSuperAdmin || user.permissions.includes('customers.read');
  const canSeeCoupons   = isSuperAdmin || user.permissions.includes('coupons.read');
  const canSeeProducts  = isSuperAdmin || user.permissions.includes('products.read') || user.permissions.includes('inventory.read');

  const [
    statusGroups,
    totalRevenueAgg,
    confirmedRevenueAgg,
    pendingRevenueAgg,
    customersCount,
    activeCouponsCount,
    outOfStockCount,
    recent,
  ] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: 'cancelled' }, paymentMethod: { not: 'gift' } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: 'delivered', paymentMethod: { not: 'gift' } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { in: ['pending', 'processing', 'paid', 'shipped'] },
        paymentMethod: { not: 'gift' },
      },
    }),
    canSeeCustomers ? prisma.user.count({ where: { role: 'customer' } }) : Promise.resolve(null),
    canSeeCoupons   ? prisma.coupon.count({ where: { isActive: true } })  : Promise.resolve(null),
    canSeeProducts  ? prisma.product.count({ where: { inStock: false } }) : Promise.resolve(null),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  // Normalise status counts to Arabic canonical labels so the UI can
  // map them straight onto STATUSES from admin-status.ts.
  const byStatus: Record<string, number> = {
    'قيد التجهيز': 0,
    'تم الدفع':    0,
    'تم الشحن':    0,
    'تم التسليم':  0,
    'ملغي':        0,
  };
  let totalOrders = 0;
  for (const g of statusGroups) {
    const label = normalizeStatus(g.status);
    if (byStatus[label] !== undefined) byStatus[label] += g._count._all;
    totalOrders += g._count._all;
  }

  return NextResponse.json({
    totalOrders,
    totalRevenue: Math.round(totalRevenueAgg._sum.total ?? 0),
    confirmedRevenue: Math.round(confirmedRevenueAgg._sum.total ?? 0),
    pendingRevenue: Math.round(pendingRevenueAgg._sum.total ?? 0),
    customersCount,
    activeCouponsCount,
    outOfStockCount,
    byStatus,
    recentOrders: recent.map(o => ({
      id: o.id,
      status: normalizeStatus(o.status),
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      userName: o.user?.name ?? '—',
    })),
  });
}
