export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

// POST /api/tareeq/[id]/like — toggle like (atomic)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-like:${ip}`, 30, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const existing = await prisma.tareeqLike.findUnique({
    where: { postId_userId: { postId: params.id, userId: user.userId } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.tareeqLike.delete({ where: { id: existing.id } }),
      prisma.tareeqPost.update({ where: { id: params.id }, data: { likeCount: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ liked: false });
  } else {
    await prisma.$transaction([
      prisma.tareeqLike.create({ data: { postId: params.id, userId: user.userId } }),
      prisma.tareeqPost.update({ where: { id: params.id }, data: { likeCount: { increment: 1 } } }),
    ]);
    return NextResponse.json({ liked: true });
  }
}
