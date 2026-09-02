export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended } from '@/lib/tareeq-guard';

// POST — toggle heart reaction on a comment
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await getAuthUser().catch(() => null);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authResult;

  const rl = tareeqRateLimit('comment-react', me.userId, 60, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(me.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const comment = await prisma.tareeqComment.findUnique({
    where: { id: params.id },
    select: { id: true, isHidden: true },
  });
  if (!comment || comment.isHidden) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const existing = await prisma.tareeqCommentReaction.findUnique({
    where: { commentId_userId: { commentId: params.id, userId: me.userId } },
  });

  if (existing) {
    await prisma.tareeqCommentReaction.delete({ where: { id: existing.id } });
    const count = await prisma.tareeqCommentReaction.count({ where: { commentId: params.id } });
    return NextResponse.json({ liked: false, count });
  } else {
    await prisma.tareeqCommentReaction.create({ data: { commentId: params.id, userId: me.userId } });
    const count = await prisma.tareeqCommentReaction.count({ where: { commentId: params.id } });
    return NextResponse.json({ liked: true, count });
  }
}

// GET — fetch like count + whether current user liked
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await getAuthUser().catch(() => null);
  const [count, myReaction] = await Promise.all([
    prisma.tareeqCommentReaction.count({ where: { commentId: params.id } }),
    authResult
      ? prisma.tareeqCommentReaction.findUnique({
          where: { commentId_userId: { commentId: params.id, userId: authResult.userId } },
          select: { id: true },
        })
      : null,
  ]);
  return NextResponse.json({ count, liked: !!myReaction });
}
