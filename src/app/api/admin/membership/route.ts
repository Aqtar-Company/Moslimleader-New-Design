export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requirePerm, type Permission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const guard = await requirePerm(['membership.read', 'membership.write'] as Permission[]);
  if ('response' in guard) return guard.response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = 20;

  const [total, memberships, rawStats] = await Promise.all([
    prisma.familyMembership.count({ where: status ? { status: status as 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED' } : {} }),
    prisma.familyMembership.findMany({
      where: status ? { status: status as 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED' } : {},
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { familyMembers: true, renewals: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.familyMembership.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ]);

  // Transform groupBy array → flat object the client expects
  const statsMap: Record<string, number> = {};
  let allTotal = 0;
  for (const row of rawStats) {
    statsMap[row.status.toLowerCase()] = row._count.id;
    allTotal += row._count.id;
  }
  const stats = {
    total: allTotal,
    active:    statsMap['active']    ?? 0,
    pending:   statsMap['pending']   ?? 0,
    expired:   statsMap['expired']   ?? 0,
    cancelled: statsMap['cancelled'] ?? 0,
  };

  return NextResponse.json({ memberships, total, page, limit, stats });
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePerm('membership.write');
  if ('response' in guard) return guard.response;

  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const ALLOWED_STATUSES = ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED'] as const;
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // When admin manually activates, reset to leader tier + set sensible dates
  const updateData: Record<string, unknown> = { status };
  if (status === 'ACTIVE') {
    updateData.tier = 'leader';
    const existing = await prisma.familyMembership.findUnique({
      where: { id },
      select: { startsAt: true, expiresAt: true },
    });
    if (!existing?.expiresAt) {
      const now = new Date();
      const expires = new Date(now);
      expires.setFullYear(expires.getFullYear() + 1);
      updateData.startsAt = existing?.startsAt ?? now;
      updateData.expiresAt = expires;
    }
  }

  const membership = await prisma.familyMembership.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ membership });
}
