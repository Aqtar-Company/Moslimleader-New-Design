export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended } from '@/lib/tareeq-guard';
import { ensureDiscussionPost } from '@/lib/media-tareeq';
import { isReactionType, reactionSummaries } from '@/lib/free-media-social';

/** GET — counts per reaction and the viewer's own. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const viewer = await getAuthUser().catch(() => null);
  const s = (await reactionSummaries([id], viewer?.userId ?? null)).get(id);
  return NextResponse.json(s);
}

/**
 * POST { type } — set the viewer's reaction; the same type again, or `type: null`, takes it
 * back. One reaction per member per item. It is written on the item's طريق discussion post
 * (made now if missing), so the count is the same on /media and in the feed — and the
 * post's likeCount follows, exactly as طريق's own react route keeps it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'سجّل الدخول للتفاعل', needsLogin: true }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const rl = await tareeqRateLimit('media-react', user.userId, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول بعد قليل' }, { status: 429 });
  if (await isTareeqSuspended(user.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const type = body.type === null ? null : isReactionType(body.type) ? body.type : undefined;
  if (type === undefined) return NextResponse.json({ error: 'تفاعل غير معروف' }, { status: 400 });

  const thread = await ensureDiscussionPost(id).catch(err => { console.error('[media reactions] discussion post', err); return null; });
  if (!thread) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const postId = thread.postId;

  const existing = await prisma.tareeqReaction.findUnique({ where: { postId_userId: { postId, userId: user.userId } } });
  await prisma.$transaction(async (tx) => {
    if (!type || existing?.type === type) {
      if (existing) {
        await tx.tareeqReaction.delete({ where: { id: existing.id } });
        await tx.$executeRaw`UPDATE \`TareeqPost\` SET likeCount = GREATEST(0, likeCount - 1) WHERE id = ${postId}`;
      }
    } else if (existing) {
      await tx.tareeqReaction.update({ where: { id: existing.id }, data: { type } });
    } else {
      await tx.tareeqReaction.create({ data: { postId, userId: user.userId, type } });
      await tx.tareeqPost.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
    }
  });
  const s = (await reactionSummaries([id], user.userId)).get(id);
  return NextResponse.json(s);
}
