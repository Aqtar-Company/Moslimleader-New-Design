export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { getMLBudgetSummary } from '@/lib/support-system';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const monthStr = searchParams.get('month'); // YYYY-MM
  let monthStart: Date, monthEnd: Date;

  if (monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    monthStart = new Date(y, m - 1, 1);
    monthEnd   = new Date(y, m, 0, 23, 59, 59);
  } else {
    monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);
  }

  const [
    pendingRequests,
    mlBudget,
    mlStats,
    copyStats,
    contentPending,
    productDemand,
  ] = await Promise.all([
    prisma.supportRequest.count({ where: { status: 'PENDING' } }),
    getMLBudgetSummary(),
    // ML support stats for the month
    prisma.muslimLeaderSupportAllocation.findMany({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
      select: { status: true, supportAmount: true, customerPayAmount: true, originalPrice: true },
    }),
    // Sponsored copy stats
    prisma.sponsoredCopy.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    // Pending impact content
    Promise.all([
      prisma.beneficiaryImpactMessage.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.beneficiaryImpactMedia.count({ where: { status: 'PENDING_REVIEW' } }),
    ]),
    // Product demand vs supply
    prisma.supportRequest.groupBy({
      by: ['productId'],
      where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      _count: { id: true },
    }),
  ]);

  const mlConsumed = mlStats.filter(a => a.status === 'CONSUMED');
  const mlApproved = mlStats.filter(a => a.status !== 'RELEASED' && a.status !== 'EXPIRED');

  const copyStatusMap: Record<string, number> = {};
  for (const row of copyStats) {
    copyStatusMap[row.status] = row._count.id;
  }

  const totalDelivered = (copyStatusMap['DELIVERED'] ?? 0)
    + (copyStatusMap['CONFIRMED'] ?? 0)
    + (copyStatusMap['COMPLETED'] ?? 0);

  // Unique beneficiaries (confirmed delivery or confirmed by beneficiary)
  const uniqueBeneficiaries = await prisma.sponsoredCopy.groupBy({
    by: ['beneficiaryUserId'],
    where: {
      beneficiaryUserId: { not: null },
      status: { in: ['DELIVERED', 'CONFIRMED', 'COMPLETED'] },
    },
  });

  // Product demand details for top 10
  const topProductIds = productDemand.slice(0, 10).map(p => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name: true },
  });
  const productMap: Record<string, string> = {};
  for (const p of products) productMap[p.id] = p.name;

  // Available copies per product
  const availablePerProduct = await prisma.sponsoredCopy.groupBy({
    by: ['productId'],
    where: { productId: { in: topProductIds }, status: 'AVAILABLE' },
    _count: { id: true },
  });
  const availableMap: Record<string, number> = {};
  for (const row of availablePerProduct) {
    availableMap[row.productId] = row._count.id;
  }

  return NextResponse.json({
    pending: pendingRequests,
    mlBudget,
    ml: {
      thisMonth: {
        approved: mlApproved.length,
        supportBeneficiaries: mlConsumed.length,
        supportValue: mlConsumed.reduce((s, a) => s + a.supportAmount, 0),
        customerPayments: mlConsumed.reduce((s, a) => s + (a.customerPayAmount ?? 0), 0),
        retailValue: mlConsumed.reduce((s, a) => s + a.originalPrice, 0),
      },
    },
    copies: {
      total: Object.values(copyStatusMap).reduce((s, v) => s + v, 0),
      available: copyStatusMap['AVAILABLE'] ?? 0,
      reserved: copyStatusMap['RESERVED'] ?? 0,
      assigned: copyStatusMap['ASSIGNED'] ?? 0,
      inPreparation: copyStatusMap['IN_PREPARATION'] ?? 0,
      readyToShip: copyStatusMap['READY_TO_SHIP'] ?? 0,
      shipped: copyStatusMap['SHIPPED'] ?? 0,
      delivered: totalDelivered,
      confirmed: (copyStatusMap['CONFIRMED'] ?? 0) + (copyStatusMap['COMPLETED'] ?? 0),
      uniqueDeliveredBeneficiaries: uniqueBeneficiaries.length,
    },
    impactContentPending: {
      messages: contentPending[0],
      media: contentPending[1],
    },
    productDemand: productDemand.slice(0, 10).map(p => ({
      productId: p.productId,
      productName: productMap[p.productId] ?? p.productId,
      pendingRequests: p._count.id,
      availableCopies: availableMap[p.productId] ?? 0,
    })),
  });
}
