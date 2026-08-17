export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = 20;

  const [total, memberships] = await Promise.all([
    prisma.familyMembership.count({ where: status ? { status: status as 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED' } : {} }),
    prisma.familyMembership.findMany({
      where: status ? { status: status as 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED' } : {},
      include: {
        owner: { select: { name: true, email: true, phone: true } },
        _count: { select: { familyMembers: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Stats
  const stats = await prisma.familyMembership.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  return NextResponse.json({ memberships, total, page, limit, stats });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const membership = await prisma.familyMembership.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ membership });
}
