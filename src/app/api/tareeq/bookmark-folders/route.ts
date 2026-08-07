import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const folders = await prisma.tareeqBookmarkFolder.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { bookmarks: true } } },
  });

  return NextResponse.json({ folders });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'اسم التصنيف مطلوب' }, { status: 400 });
  }

  const count = await prisma.tareeqBookmarkFolder.count({ where: { userId: user.userId } });
  if (count >= 50) return NextResponse.json({ error: 'الحد الأقصى 50 تصنيفاً' }, { status: 400 });

  const folder = await prisma.tareeqBookmarkFolder.create({
    data: { userId: user.userId, name: name.trim() },
  });

  return NextResponse.json({ folder });
}
