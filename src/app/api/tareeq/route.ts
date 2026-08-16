export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';
import { CATEGORY_KEY } from '@/lib/tareeq-constants';

// GET /api/tareeq?cursor=xxx&category=xxx&limit=12&likedBy=userId&sort=newest|liked|following|useful
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get('cursor') || undefined;
  const category = searchParams.get('category') || undefined;
  const search = searchParams.get('search')?.trim() || undefined;
  const userId = searchParams.get('userId') || undefined;
  const likedBy = searchParams.get('likedBy') || undefined;
  const sort = searchParams.get('sort') ?? 'newest';
  const limit = Math.min(Number(searchParams.get('limit') ?? 12), 30);
  const orderBy: object | object[] = sort === 'liked'
    ? { likeCount: 'desc' as const }
    : sort === 'useful'
    ? [
        { bookmarks: { _count: 'desc' as const } },
        { likeCount: 'desc' as const },
        { createdAt: 'desc' as const },
      ]
    : { createdAt: 'desc' as const };

  // sort=following — return posts only from users the current viewer follows
  if (sort === 'following') {
    let followingIds: string[] = [];
    const meResult = await getAuthUser().catch(() => null);
    if (meResult) {
      try {
        const follows = await prisma.tareeqFollow.findMany({
          where: { followerId: meResult.userId },
          select: { followingId: true },
        });
        followingIds = follows.map((f: { followingId: string }) => f.followingId);
      } catch { /* db error */ }
    }

    if (followingIds.length === 0) {
      return NextResponse.json({ posts: [], nextCursor: null });
    }

    const followWhere = {
      isHidden: false,
      userId: { in: followingIds },
      ...(category ? { category } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
          { authorName: { contains: search } },
        ],
      } : {}),
    };

    const followPosts = await prisma.tareeqPost.findMany({
      where: followWhere,
      orderBy: { createdAt: 'desc' as const },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, title: true, summary: true, content: true,
        category: true, tags: true, imageUrl: true, imageUrls: true, videoUrl: true, authorName: true,
        likeCount: true, commentCount: true, createdAt: true, userId: true,
        pinnedCommentId: true, postUpdate: true, postUpdateAt: true,
        seriesId: true, seriesTitle: true, seriesOrder: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const hasMoreFollow = followPosts.length > limit;
    const followItems = hasMoreFollow ? followPosts.slice(0, limit) : followPosts;
    const followNextCursor = hasMoreFollow ? followItems[followItems.length - 1].id : null;
    return NextResponse.json({ posts: followItems, nextCursor: followNextCursor });
  }

  // likedBy: return posts liked by a specific user (via TareeqLike join)
  if (likedBy) {
    const likes = await prisma.tareeqLike.findMany({
      where: { userId: likedBy, post: { isHidden: false } },
      orderBy: orderBy.hasOwnProperty('likeCount')
        ? { post: { likeCount: 'desc' } }
        : { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        post: {
          select: {
            id: true, title: true, summary: true, content: true,
            category: true, tags: true, imageUrl: true, imageUrls: true, videoUrl: true, authorName: true,
            likeCount: true, commentCount: true, createdAt: true, userId: true,
            pinnedCommentId: true, postUpdate: true, postUpdateAt: true,
            seriesId: true, seriesTitle: true, seriesOrder: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });
    const hasMore = likes.length > limit;
    const items = (hasMore ? likes.slice(0, limit) : likes).map(l => l.post);
    const nextCursor = hasMore ? likes[limit - 1].id : null;
    return NextResponse.json({ posts: items, nextCursor });
  }

  const where = {
    isHidden: false,
    ...(category ? { category } : {}),
    ...(userId ? { userId } : {}),
    ...(sort === 'useful' ? { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } } : {}),
    ...(search ? {
      OR: [
        { title: { contains: search } },
        { content: { contains: search } },
        { authorName: { contains: search } },
      ],
    } : {}),
  };

  const posts = await prisma.tareeqPost.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, title: true, summary: true, content: true,
      category: true, tags: true, imageUrl: true, imageUrls: true, videoUrl: true, authorName: true,
      likeCount: true, commentCount: true, createdAt: true, userId: true,
      pinnedCommentId: true, postUpdate: true, postUpdateAt: true,
      seriesId: true, seriesTitle: true, seriesOrder: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ posts: items, nextCursor });
}

// POST /api/tareeq — create a new علامة
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  const title = String(body.title ?? '').trim() || null;
  const summary = String(body.summary ?? '').trim() || null;

  // Normalize category to canonical English key
  const rawCategory = String(body.category ?? '').trim();
  const category = rawCategory ? (CATEGORY_KEY[rawCategory] ?? null) : null;

  // Validate tags — strings only, max 50 chars each, max 10 tags
  const rawTags = body.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags
        .filter((t): t is string => typeof t === 'string')
        .map(t => t.trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, 10)
    : null;

  // Media URLs (already uploaded via /api/tareeq/upload)
  const imageUrl = String(body.imageUrl ?? '').trim() || null;
  const rawImageUrls = body.imageUrls;
  const imageUrls: string[] | null = Array.isArray(rawImageUrls)
    ? rawImageUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0).slice(0, 9)
    : null;
  const videoUrl = String(body.videoUrl ?? '').trim() || null;

  const hasMedia = !!(imageUrl || (imageUrls?.length) || videoUrl);
  if (!hasMedia && content.length < 1) {
    return NextResponse.json({ error: 'أضف نصاً أو صورة' }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: 'النص طويل جداً (5000 حرف كحد أقصى)' }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true, avatarUrl: true } });

  // Series: resolve or create seriesId from seriesTitle
  const rawSeriesTitle = String(body.seriesTitle ?? '').trim().slice(0, 80) || null;
  let seriesId: string | null = null;
  let seriesOrder: number | null = null;
  if (rawSeriesTitle) {
    // Count existing posts in this series atomically to derive seriesOrder
    const [existing, seriesCount] = await Promise.all([
      prisma.tareeqPost.findFirst({
        where: { userId: user.userId, seriesTitle: rawSeriesTitle },
        select: { seriesId: true },
      }),
      prisma.tareeqPost.count({
        where: { userId: user.userId, seriesTitle: rawSeriesTitle },
      }),
    ]);
    seriesId = existing?.seriesId ?? crypto.randomUUID();
    seriesOrder = seriesCount + 1;
  }

  const post = await prisma.tareeqPost.create({
    data: {
      content,
      title,
      summary,
      category,
      tags: tags ?? undefined,
      imageUrl: imageUrl ?? (imageUrls?.[0] ?? null),
      imageUrls: imageUrls ?? undefined,
      videoUrl,
      userId: user.userId,
      authorName: dbUser?.name ?? 'مجهول',
      ...(seriesId ? { seriesId, seriesTitle: rawSeriesTitle, seriesOrder } : {}),
    },
  });

  return NextResponse.json({ ok: true, id: post.id });
}
