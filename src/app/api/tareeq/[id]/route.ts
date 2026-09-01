export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended } from '@/lib/tareeq-guard';
import { filterContent } from '@/lib/tareeq-content-filter';

// GET /api/tareeq/[id] — returns post + userLiked + userBookmarked
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true, content: true, createdAt: true, userId: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // Resolve current user once for both view recording and like/bookmark checks
  const authUser = await getAuthUser().catch(() => null);

  // Increment view count and record viewer (non-blocking)
  prisma.$transaction([
    prisma.tareeqPostView.create({ data: { postId: params.id, userId: authUser?.userId ?? null } }),
    prisma.tareeqPost.update({ where: { id: params.id }, data: { viewCount: { increment: 1 } } }),
  ]).catch(() => {});

  // Check if current user already liked/bookmarked/subscribed
  let userLiked = false;
  let userBookmarked = false;
  let userSubscribed = false;
  try {
    if (!authUser) throw new Error('not logged in');
    const [like, bookmark, subscription] = await Promise.all([
      prisma.tareeqLike.findUnique({ where: { postId_userId: { postId: params.id, userId: authUser.userId } } }),
      prisma.tareeqBookmark.findUnique({ where: { postId_userId: { postId: params.id, userId: authUser.userId } } }),
      prisma.tareeqPostSubscription.findUnique({ where: { postId_userId: { postId: params.id, userId: authUser.userId } } }),
    ]);
    userLiked = !!like;
    userBookmarked = !!bookmark;
    userSubscribed = !!subscription;
  } catch { /* not logged in — defaults stay false */ }

  return NextResponse.json({ post, userLiked, userBookmarked, userSubscribed });
}

// PUT /api/tareeq/[id] — edit (owner only)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const rl = tareeqRateLimit('edit', user.userId, 20, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(user.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { userId: true, createdAt: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (post.userId !== user.userId) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (post.createdAt < hourAgo) {
    return NextResponse.json({ error: 'Edit window expired — posts can only be edited within 1 hour of posting' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  const title = String(body.title ?? '').trim() || null;

  if (content.length < 10) return NextResponse.json({ error: 'اكتب أكثر' }, { status: 400 });
  if (content.length > 5000) return NextResponse.json({ error: 'النص طويل جداً' }, { status: 400 });

  // The create route runs edited text through the same content filter — an
  // edit was previously a way to reintroduce content that filter would have
  // auto-hidden at creation time, with no re-check at all.
  const filterResult = filterContent([content, title].filter(Boolean).join(' '));

  await prisma.tareeqPost.update({
    where: { id: params.id },
    data: {
      content, title, updatedAt: new Date(),
      ...(filterResult.flagged ? { isHidden: true, hiddenReason: filterResult.reason ?? 'auto-filter' } : {}),
    },
  });

  return NextResponse.json({ ok: true, flagged: filterResult.flagged });
}

// DELETE /api/tareeq/[id] — owner or admin only
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const rl = tareeqRateLimit('delete', user.userId, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  if (post.userId !== user.userId && user.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  await prisma.tareeqPost.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
