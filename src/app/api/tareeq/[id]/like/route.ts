export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// POST /api/tareeq/[id]/like — toggle like
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const existing = await prisma.tareeqLike.findUnique({
    where: { postId_userId: { postId: params.id, userId: user.userId } },
  });

  if (existing) {
    await prisma.tareeqLike.delete({ where: { id: existing.id } });
    await prisma.tareeqPost.update({ where: { id: params.id }, data: { likeCount: { decrement: 1 } } });
    return NextResponse.json({ liked: false });
  } else {
    await prisma.tareeqLike.create({ data: { postId: params.id, userId: user.userId } });
    await prisma.tareeqPost.update({ where: { id: params.id }, data: { likeCount: { increment: 1 } } });
    return NextResponse.json({ liked: true });
  }
}
