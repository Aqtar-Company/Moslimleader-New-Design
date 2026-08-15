export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendPushToUser } from '@/lib/tareeq-push';

// GET /api/tareeq/[id]/comments?cursor=xxx
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const cursor = req.nextUrl.searchParams.get('cursor') || undefined;
  const limit = 50;

  const comments = await prisma.tareeqComment.findMany({
    where: { postId: params.id },
    orderBy: { createdAt: 'asc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, content: true, createdAt: true, userId: true,
      user: { select: { id: true, name: true } },
    },
  });

  const hasMore = comments.length > limit;
  const items = hasMore ? comments.slice(0, limit) : comments;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  return NextResponse.json({ comments: items, nextCursor });
}

// POST /api/tareeq/[id]/comments
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-comment:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();

  if (content.length < 2) return NextResponse.json({ error: 'اكتب تعليقك' }, { status: 400 });
  if (content.length > 500) return NextResponse.json({ error: 'التعليق طويل جداً' }, { status: 400 });

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { id: true, userId: true, title: true, imageUrl: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const [comment] = await prisma.$transaction([
    prisma.tareeqComment.create({
      data: { postId: params.id, userId: user.userId, content },
      select: {
        id: true, content: true, createdAt: true, userId: true,
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.tareeqPost.update({ where: { id: params.id }, data: { commentCount: { increment: 1 } } }),
  ]);

  // Parse @mentions and notify mentioned users (non-blocking, batched, max 3)
  const commenterName = comment.user?.name ?? 'شخص ما';
  const mentionMatches = (content.match(/@([؀-ۿa-zA-Z0-9_][^\s@]{1,19})/g) ?? []).slice(0, 3);
  if (mentionMatches.length > 0) {
    const names = mentionMatches.map(m => m.slice(1).trim());
    prisma.user.findMany({ where: { name: { in: names } }, select: { id: true } })
      .then(mentioned => {
        for (const m of mentioned) {
          if (m.id !== user.userId) {
            prisma.tareeqNotification.create({
              data: {
                userId: m.id,
                type: 'mention',
                actorId: user.userId,
                actorName: commenterName,
                postId: params.id,
                postTitle: post.title ?? null,
                body: content.slice(0, 120),
              },
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }

  // Notify post author (non-blocking)
  if (post.userId && post.userId !== user.userId) {
    const actorName = user.name ?? 'شخص ما';
    prisma.tareeqNotification.create({
      data: {
        userId: post.userId,
        type: 'comment',
        actorId: user.userId,
        actorName: actorName,
        postId: post.id,
        postTitle: post.title ?? null,
        body: content.slice(0, 120),
      },
    }).catch(() => {});
    sendPushToUser(post.userId, {
      title: 'طريق ★',
      body: `${actorName} علّق على علامتك: ${content.slice(0, 60)}`,
      url: `/tareeq/${post.id}`,
      tag: `comment-${post.id}`,
      type: 'comment',
      postId: post.id,
      image: post.imageUrl ?? undefined,
    }).catch(() => {});
  }

  // Notify post subscribers (non-blocking)
  prisma.tareeqPostSubscription.findMany({
    where: { postId: params.id },
    select: { userId: true },
  }).then(async (subs) => {
    const commenterName = comment.user?.name ?? 'شخص ما';
    for (const sub of subs) {
      if (sub.userId === user.userId) continue;  // don't notify the commenter
      if (sub.userId === post.userId) continue;  // post author already notified above
      await prisma.tareeqNotification.create({
        data: {
          userId: sub.userId,
          type: 'subscribed_comment',
          actorId: user.userId,
          actorName: commenterName,
          postId: post.id,
          postTitle: post.title ?? null,
          body: content.slice(0, 120),
        },
      }).catch(() => {});
    }
  }).catch(() => {});

  return NextResponse.json({ ok: true, comment });
}
