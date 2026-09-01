export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended } from '@/lib/tareeq-guard';
import { sendPushToUser } from '@/lib/tareeq-push';

// POST /api/tareeq/[id]/like — toggle like (atomic)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const rl = tareeqRateLimit('like', user.userId, 30, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(user.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, title: true, imageUrl: true },
  });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

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
    // Notify post author (non-blocking, never fail the like)
    if (post.userId && post.userId !== user.userId) {
      const actorName = user.name ?? 'شخص ما';
      prisma.tareeqNotification.create({
        data: {
          userId: post.userId,
          type: 'like',
          actorId: user.userId,
          actorName: actorName,
          postId: post.id,
          postTitle: post.title ?? null,
        },
      }).catch(() => {});
      sendPushToUser(post.userId, {
        title: 'طريق ★',
        body: `${actorName} أعجب بعلامتك`,
        url: `/tareeq/${post.id}`,
        tag: `like-${post.id}`,
        type: 'like',
        postId: post.id,
        image: post.imageUrl ?? undefined,
      }).catch(() => {});
    }
    return NextResponse.json({ liked: true });
  }
}
