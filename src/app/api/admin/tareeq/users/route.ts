export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const suspended = url.searchParams.get('suspended');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = 20;

  const where: Record<string, unknown> = {};
  if (q.trim()) {
    where.OR = [
      { name: { contains: q.trim() } },
      { email: { contains: q.trim() } },
    ];
  }
  if (suspended === 'true') where.tareeqSuspended = true;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, avatarUrl: true,
        tareeqSuspended: true, tareeqSuspendedAt: true, tareeqSuspendReason: true,
        createdAt: true,
        _count: { select: { tareeqPosts: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ users, total, page, limit });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, tareeqSuspended, tareeqSuspendReason } = await req.json().catch(() => ({}));
  if (!id || typeof tareeqSuspended !== 'boolean') return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const user = await prisma.user.update({
    where: { id },
    data: {
      tareeqSuspended,
      tareeqSuspendedAt: tareeqSuspended ? new Date() : null,
      tareeqSuspendReason: tareeqSuspended ? (tareeqSuspendReason ?? 'مخالف للسياسات') : null,
    },
    select: { id: true, name: true, tareeqSuspended: true },
  });

  return NextResponse.json({ user });
}
