export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended } from '@/lib/tareeq-guard';

const ALLOWED_TYPES = ['heart', 'inspired', 'thanks', 'agree', 'yarabb'] as const;
type CommentReactionType = typeof ALLOWED_TYPES[number];

// POST — toggle reaction on a comment (type: heart | inspired | thanks | agree | yarabb)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await getAuthUser().catch(() => null);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authResult;

  const rl = tareeqRateLimit('comment-react', me.userId, 60, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(me.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const type: CommentReactionType = ALLOWED_TYPES.includes(body.type) ? body.type : 'heart';

  const comment = await prisma.tareeqComment.findUnique({
    where: { id: params.id },
    select: { id: true, isHidden: true },
  });
  if (!comment || comment.isHidden) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const existing = await prisma.tareeqCommentReaction.findUnique({
    where: { commentId_userId: { commentId: params.id, userId: me.userId } },
  });

  if (existing) {
    if (existing.type === type) {
      // Same type → remove (toggle off)
      await prisma.tareeqCommentReaction.delete({ where: { id: existing.id } });
      const counts = await getReactionCounts(params.id);
      return NextResponse.json({ reaction: null, counts });
    } else {
      // Different type → switch
      await prisma.tareeqCommentReaction.update({ where: { id: existing.id }, data: { type } });
      const counts = await getReactionCounts(params.id);
      return NextResponse.json({ reaction: type, counts });
    }
  } else {
    await prisma.tareeqCommentReaction.create({ data: { commentId: params.id, userId: me.userId, type } });
    const counts = await getReactionCounts(params.id);
    return NextResponse.json({ reaction: type, counts });
  }
}

async function getReactionCounts(commentId: string) {
  const rows = await prisma.tareeqCommentReaction.groupBy({
    by: ['type'],
    where: { commentId },
    _count: true,
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.type] = r._count;
  return counts;
}

// GET — fetch reaction counts + current user's reaction
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await getAuthUser().catch(() => null);
  const [counts, myReaction] = await Promise.all([
    getReactionCounts(params.id),
    authResult
      ? prisma.tareeqCommentReaction.findUnique({
          where: { commentId_userId: { commentId: params.id, userId: authResult.userId } },
          select: { type: true },
        })
      : null,
  ]);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return NextResponse.json({ counts, total, reaction: myReaction?.type ?? null });
}
