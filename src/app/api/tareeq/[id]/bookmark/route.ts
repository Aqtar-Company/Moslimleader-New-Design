export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// POST /api/tareeq/[id]/bookmark — toggle bookmark
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const existing = await prisma.tareeqBookmark.findUnique({
    where: { postId_userId: { postId: params.id, userId: user.userId } },
  });

  if (existing) {
    await prisma.tareeqBookmark.delete({ where: { id: existing.id } });
    return NextResponse.json({ bookmarked: false });
  } else {
    await prisma.tareeqBookmark.create({ data: { postId: params.id, userId: user.userId } });
    return NextResponse.json({ bookmarked: true });
  }
}
