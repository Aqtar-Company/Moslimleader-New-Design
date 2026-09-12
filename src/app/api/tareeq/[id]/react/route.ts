export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended, isBlockedEitherWay } from '@/lib/tareeq-guard';
import { notifyTareeq, type TareeqNotifType } from '@/lib/tareeq-notify';

const VALID_TYPES = ['inspired', 'thanks', 'agree', 'yarabb', 'mashaallah'] as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await getAuthUser().catch(() => null);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authResult;

  const rl = await tareeqRateLimit('react', me.userId, 60, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(me.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { type } = body;
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  // Verify post exists before any mutation
  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { id: true, userId: true, title: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  if (post.userId && await isBlockedEitherWay(me.userId, post.userId)) {
    return NextResponse.json({ error: 'لا يمكن التفاعل مع هذا المنشور' }, { status: 403 });
  }

  const existing = await prisma.tareeqReaction.findUnique({
    where: { postId_userId: { postId: params.id, userId: me.userId } },
  });

  // A user who liked this post before reactions existed still has a legacy TareeqLike row
  // that already contributed its own +1 to likeCount. It has to be looked up on EVERY
  // path, not just the new-reaction one: someone who reacted before this fix carries both
  // rows and a permanently inflated count, and their stale like also makes the card render
  // the star as active again after they toggle the reaction off.
  const legacyLike = await prisma.tareeqLike.findUnique({
    where: { postId_userId: { postId: params.id, userId: me.userId } },
    select: { id: true },
  });
  const hadLike = !!legacyLike;

  // One person contributes at most 1 to likeCount, whether via a like, a reaction, or the
  // double row this fix retires. `delta` is what that person's contribution changes by.
  let reaction: string | null;
  let delta: number;
  if (existing?.type === type) {
    reaction = null;
    delta = -(1 + (hadLike ? 1 : 0)); // reaction goes away, and the stale like with it
  } else if (existing) {
    reaction = type;
    delta = hadLike ? -1 : 0; // type switch counts nothing; the stale like is repaid
  } else {
    reaction = type;
    delta = hadLike ? 0 : 1; // convert the like rather than stacking on it
  }

  await prisma.$transaction(async (tx) => {
    if (legacyLike) await tx.tareeqLike.delete({ where: { id: legacyLike.id } });
    if (existing?.type === type) {
      await tx.tareeqReaction.delete({ where: { id: existing!.id } });
    } else if (existing) {
      await tx.tareeqReaction.update({ where: { id: existing!.id }, data: { type } });
    } else {
      await tx.tareeqReaction.create({ data: { postId: params.id, userId: me.userId, type } });
    }
    if (delta > 0) {
      await tx.tareeqPost.update({ where: { id: params.id }, data: { likeCount: { increment: delta } } });
    } else if (delta < 0) {
      await tx.$executeRaw`UPDATE \`TareeqPost\` SET likeCount = GREATEST(0, likeCount - ${-delta}) WHERE id = ${params.id}`;
    }
  });

  // Notify the post author on a genuinely new reaction only (skip self, skip type switches
  // and toggles-off).
  if (!existing && post.userId) {
    const actor = await prisma.user.findUnique({ where: { id: me.userId }, select: { name: true, avatarUrl: true } });
    const actorName = actor?.name ?? 'شخص ما';
    const LABELS: Record<string, string> = { inspired: 'ألهمه ⭐', thanks: 'شكره 🙏', agree: 'يتفق معه ✊', yarabb: 'يارب 🤲', mashaallah: 'ماشاء الله 🌴' };
    // The reaction kind IS the notification type, and all five share one preference switch
    // ('reactions') — nobody wants to decide separately about "ألهمه" and "شكره".
    void notifyTareeq({
      userId: post.userId,
      type: type as TareeqNotifType,
      actorId: me.userId,
      actorName,
      actorAvatarUrl: actor?.avatarUrl ?? null,
      postId: post.id,
      postTitle: post.title ?? null,
      push: {
        title: 'طريق ★',
        body: `${actorName} ${LABELS[type] ?? 'تفاعل مع علامتك'}`,
        url: `/tareeq/${post.id}`,
        tag: `react-${post.id}-${me.userId}`,
        type: 'like',
        postId: post.id,
      },
    });
  }

  // Return the authoritative count: the client cannot predict it (a converted legacy like
  // changes nothing), and guessing left the on-screen number one below the truth.
  const fresh = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { likeCount: true } });
  return NextResponse.json({ reaction, likeCount: fresh?.likeCount ?? 0 });
}

// GET — fetch reaction counts or full reactor list (?users=1)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const withUsers = req.nextUrl.searchParams.get('users') === '1';
  if (withUsers) {
    const authResult = await getAuthUser().catch(() => null);
    if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const reactions = await prisma.tareeqReaction.findMany({
      where: { postId: params.id },
      select: { type: true, user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return NextResponse.json({ reactions });
  }
  const reactions = await prisma.tareeqReaction.groupBy({
    by: ['type'],
    where: { postId: params.id },
    _count: { type: true },
  });
  const counts: Record<string, number> = {};
  for (const r of reactions) counts[r.type] = r._count.type;
  return NextResponse.json({ counts });
}
