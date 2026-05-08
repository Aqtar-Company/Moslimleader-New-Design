export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { getAllReceivableBalances } from '@/lib/customer-receivables';
import { NON_GIFT } from '@/lib/order-filters';

// GET — list of every wholesale dealer with the financial fields
// needed by the operational view: order count, lifetime spend, balance
// owed (positive = they owe us). The marketing view stays under
// /admin/customers; this is the financial / operational view.
export async function GET() {
  const guard = await requirePerm('wholesale.read');
  if ('response' in guard) return guard.response;

  const [wholesalers, balances, orderAggs] = await Promise.all([
    prisma.user.findMany({
      where: { isWholesale: true },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    getAllReceivableBalances(),
    // Per-customer lifetime totals, computed in one round-trip.
    // groupBy doesn't accept `userId: { not: null }` cleanly here; we
    // filter the rows in JS after the call (the groupBy itself can't
    // produce a null group when wholesalers list filters to real users).
    prisma.order.groupBy({
      by: ['userId'],
      where: NON_GIFT,
      _count: true,
      _sum: { total: true },
      _max: { createdAt: true },
    }),
  ]);

  const aggMap = new Map<string, { count: number; total: number; lastAt: Date | null }>();
  for (const a of orderAggs) {
    if (!a.userId) continue;
    aggMap.set(a.userId, {
      count: typeof a._count === 'number' ? a._count : 0,
      total: Number(a._sum?.total ?? 0),
      lastAt: a._max?.createdAt ?? null,
    });
  }

  const rows = wholesalers.map(w => {
    const agg = aggMap.get(w.id);
    return {
      id: w.id,
      name: w.name,
      email: w.email,
      phone: w.phone ?? null,
      createdAt: w.createdAt.toISOString(),
      orderCount: agg?.count ?? 0,
      totalSpend: Math.round(agg?.total ?? 0),
      lastOrderAt: agg?.lastAt?.toISOString() ?? null,
      balance: balances.get(w.id) ?? 0, // positive = they owe us
    };
  });

  // Sort: outstanding balances first (operationally most urgent), then
  // by total spend.
  rows.sort((a, b) => {
    if (a.balance !== b.balance) return b.balance - a.balance;
    return b.totalSpend - a.totalSpend;
  });

  // Roll up totals for the page header KPIs.
  const totals = rows.reduce((acc, r) => ({
    count: acc.count + 1,
    totalSpend: acc.totalSpend + r.totalSpend,
    totalOutstanding: acc.totalOutstanding + Math.max(0, r.balance),
    totalOverpaid: acc.totalOverpaid + Math.max(0, -r.balance),
  }), { count: 0, totalSpend: 0, totalOutstanding: 0, totalOverpaid: 0 });

  return NextResponse.json({ rows, totals });
}
