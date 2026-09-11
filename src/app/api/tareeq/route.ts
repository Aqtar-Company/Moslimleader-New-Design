export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isBlockedEitherWay } from '@/lib/tareeq-guard';
import { CATEGORY_KEY } from '@/lib/tareeq-constants';
import { filterContent, validateMediaUrl } from '@/lib/tareeq-content-filter';
import { SHARED_FROM_SELECT, normalizeSharedFrom } from '@/lib/tareeq-post-select';
import { postSearchWhere } from '@/lib/tareeq-search';
import { notifyTareeq } from '@/lib/tareeq-notify';

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
  // Cursor pagination (`cursor: { id }, skip: 1` below) needs the orderBy to fully and
  // deterministically order the table — otherwise rows tied on the leading sort key(s)
  // can land on either side of the cursor boundary unpredictably between requests,
  // dropping or duplicating posts while scrolling. `id` is unique and is the cursor
  // field itself, so appending it as the final tiebreaker makes every sort stable.
  const orderBy: object | object[] = sort === 'liked'
    ? [{ likeCount: 'desc' as const }, { id: 'desc' as const }]
    : sort === 'useful'
    ? [
        // savedCount is the denormalized column the card renders; ranking on it avoids a
        // correlated aggregate subquery that no index can serve. NOTE: any popularity
        // sort is only stable within a snapshot — counts change between page fetches, so
        // items can still shift across the cursor boundary. The tiebreaker removes the
        // tie-related churn; the residual drift is inherent to ranking on live counters.
        { savedCount: 'desc' as const },
        { likeCount: 'desc' as const },
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ]
    : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

  // Anyone in a block relationship with the viewer (either direction) is excluded from
  // every branch below. This is resolved up-front — it used to be computed only for the
  // main feed AND skipped entirely whenever `userId` was set, so a blocked viewer could
  // still read a blocker's entire timeline via /api/tareeq?userId=<blocker>.
  const viewerForBlocks = await getAuthUser().catch(() => null);
  let blockedIds: string[] = [];
  let mutedIds: string[] = [];
  if (viewerForBlocks) {
    const blocks = await prisma.tareeqBlock.findMany({
      where: { OR: [{ blockerId: viewerForBlocks.userId }, { blockedId: viewerForBlocks.userId }] },
      select: { blockerId: true, blockedId: true },
    });
    blockedIds = blocks.map(b => (b.blockerId === viewerForBlocks.userId ? b.blockedId : b.blockerId));

    // Mutes are kept in their OWN list, not folded into blockedIds. Two differences that
    // matter:
    //  - A mute is one-directional: being muted does not hide that person from you, so
    //    this reads muterId only.
    //  - A mute hides someone from your FEED, not from their own page. Folding it into
    //    blockedIds made the guard below return an empty timeline when you deliberately
    //    opened a muted person's profile, which is not what muting means.
    const mutes = await prisma.tareeqMute.findMany({
      where: { muterId: viewerForBlocks.userId, mutedId: { not: null } },
      select: { mutedId: true },
    });
    mutedIds = mutes.map(m => m.mutedId!).filter(Boolean);
  }
  // A blocked author is never visible, even when explicitly requested by id.
  if (userId && blockedIds.includes(userId)) {
    return NextResponse.json({ posts: [], nextCursor: null });
  }

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
      isDraft: false,
      // Muted authors leave the feed; blocked ones were already filtered out of
      // followingIds' source relationship.
      userId: { in: followingIds.filter(id => !blockedIds.includes(id) && !mutedIds.includes(id)) },
      ...(category ? { category } : {}),
      ...postSearchWhere(search),
    };

    const followPosts = await prisma.tareeqPost.findMany({
      where: followWhere,
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, title: true, summary: true, content: true,
        category: true, tags: true, imageUrl: true, imageAlt: true, imageUrls: true, videoUrl: true, thumbnailUrl: true, authorName: true,
        likeCount: true, commentCount: true, savedCount: true, createdAt: true, userId: true,
        pinnedCommentId: true, postUpdate: true, postUpdateAt: true,
        seriesId: true, seriesTitle: true, seriesOrder: true,
        ...SHARED_FROM_SELECT,
        user: { select: { id: true, name: true, avatarUrl: true, role: true } },
        // No orderBy here previously meant Prisma picked one row per distinct type in
        // whatever order the DB scan happened to return — an arbitrary, not "top",
        // selection. Ordering by recency at least makes it deterministic and reflects
        // which reaction types are currently active; a true popularity ranking would
        // need a per-post groupBy, too costly to run for every post in a feed page.
        reactions: { distinct: ['type'], orderBy: { createdAt: 'desc' as const }, select: { type: true }, take: 40 },
      },
    });

    const hasMoreFollow = followPosts.length > limit;
    const followItems = (hasMoreFollow ? followPosts.slice(0, limit) : followPosts).map(p => ({
      ...p,
      topReactions: p.reactions.map((r: { type: string }) => r.type),
      reactions: undefined,
      sharedFrom: normalizeSharedFrom(p.sharedFrom),
    }));
    const followNextCursor = hasMoreFollow ? followItems[followItems.length - 1].id : null;
    return NextResponse.json({ posts: followItems, nextCursor: followNextCursor });
  }

  // likedBy: return posts liked by a specific user (via TareeqLike join)
  if (likedBy) {
    const likes = await prisma.tareeqLike.findMany({
      where: {
        userId: likedBy,
        post: { isHidden: false, ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}) },
      },
      // Checking `orderBy.hasOwnProperty('likeCount')` broke once `orderBy` above became
      // an array for sort==='liked' (arrays don't own that key) — check `sort` directly
      // instead. The `id` tiebreaker is this model's own (unique, cursor) id, needed for
      // the same reason as above: `post.likeCount` alone isn't a stable sort for paging.
      orderBy: sort === 'liked'
        ? [{ post: { likeCount: 'desc' as const } }, { id: 'desc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        post: {
          select: {
            id: true, title: true, summary: true, content: true,
            category: true, tags: true, imageUrl: true, imageAlt: true, imageUrls: true, videoUrl: true, thumbnailUrl: true, authorName: true,
            likeCount: true, commentCount: true, savedCount: true, createdAt: true, userId: true,
            pinnedCommentId: true, postUpdate: true, postUpdateAt: true,
            seriesId: true, seriesTitle: true, seriesOrder: true,
            user: { select: { id: true, name: true, avatarUrl: true, role: true } },
            ...SHARED_FROM_SELECT,
            reactions: { distinct: ['type'], orderBy: { createdAt: 'desc' as const }, select: { type: true }, take: 40 },
          },
        },
      },
    });
    const hasMore = likes.length > limit;
    const items = (hasMore ? likes.slice(0, limit) : likes).map(l => ({
      ...l.post,
      topReactions: l.post.reactions.map((r: { type: string }) => r.type),
      reactions: undefined,
      sharedFrom: normalizeSharedFrom(l.post.sharedFrom),
    }));
    const nextCursor = hasMore ? likes[limit - 1].id : null;
    return NextResponse.json({ posts: items, nextCursor });
  }

  const where = {
    isHidden: false,
    // A draft is a real row now, and it belongs to nobody's feed — not even its author's.
    // It is reachable only through the drafts list.
    isDraft: false,
    ...(category ? { category } : {}),
    // AND (not two spreads) — both of these constrain `userId`, so spreading them side by
    // side silently dropped whichever came first.
    AND: [
      ...(userId ? [{ userId }] : []),
      ...(blockedIds.length ? [{ userId: { notIn: blockedIds } }] : []),
      // Muted authors are dropped from the browse feed only. When `userId` is set the
      // viewer asked for that person's page on purpose, so the mute does not apply.
      ...(!userId && mutedIds.length ? [{ userId: { notIn: mutedIds } }] : []),
    ],
    ...(sort === 'useful' ? { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } } : {}),
    ...postSearchWhere(search),
  };

  const posts = await prisma.tareeqPost.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, title: true, summary: true, content: true,
      category: true, tags: true, imageUrl: true, imageAlt: true, imageUrls: true, videoUrl: true, thumbnailUrl: true, authorName: true,
      likeCount: true, commentCount: true, savedCount: true, createdAt: true, userId: true,
      pinnedCommentId: true, postUpdate: true, postUpdateAt: true,
      seriesId: true, seriesTitle: true, seriesOrder: true,
      ...SHARED_FROM_SELECT,
      user: { select: { id: true, name: true, avatarUrl: true } },
      reactions: { distinct: ['type'], orderBy: { createdAt: 'desc' as const }, select: { type: true }, take: 40 },
    },
  });

  const hasMore = posts.length > limit;
  const items = (hasMore ? posts.slice(0, limit) : posts).map(p => ({
    ...p,
    topReactions: p.reactions.map((r: { type: string }) => r.type),
    reactions: undefined,
    // Never let a hidden original leak out through someone's share of it. The card shows
    // an "unavailable" placeholder for a null sharedFrom.
    sharedFrom: normalizeSharedFrom(p.sharedFrom),
  }));
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ posts: items, nextCursor });
}

// POST /api/tareeq — create a new علامة
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const rl = tareeqRateLimit('post', user.userId, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  // Check if user is suspended from Tareeq (also fetch name/avatar for post creation below)
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { tareeqSuspended: true, name: true, avatarUrl: true } });
  if (!dbUser) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (dbUser.tareeqSuspended) return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });

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
  // Author's description of the image, for screen readers. Capped like a caption rather
  // than left as Text-length free input — it is read aloud, not published as prose.
  const imageAlt = String(body.imageAlt ?? '').trim().slice(0, 300) || null;
  // The composer sends this for every video post; it used to be read by nothing.
  const thumbnailUrl = String(body.thumbnailUrl ?? '').trim() || null;

  // A share points at the original instead of copying its text — see the schema comment
  // on TareeqPost.sharedFromId.
  const sharedFromId = String(body.sharedFromId ?? '').trim() || null;
  let sharedFromAuthorId: string | null = null;
  if (sharedFromId) {
    const original = await prisma.tareeqPost.findUnique({
      where: { id: sharedFromId },
      select: { id: true, userId: true, isHidden: true, sharedFromId: true },
    });
    if (!original) return NextResponse.json({ error: 'المنشور غير موجود' }, { status: 404 });
    if (original.isHidden) return NextResponse.json({ error: 'لا يمكن مشاركة هذا المنشور' }, { status: 403 });
    if (original.userId && await isBlockedEitherWay(user.userId, original.userId)) {
      return NextResponse.json({ error: 'لا يمكن مشاركة هذا المنشور' }, { status: 403 });
    }
    // Sharing a share attributes the ORIGINAL, not the middleman — otherwise the embed
    // nests without limit and the first author disappears a level at a time.
    sharedFromAuthorId = original.userId;
    if (original.sharedFromId) {
      const root = await prisma.tareeqPost.findUnique({
        where: { id: original.sharedFromId },
        select: { id: true, userId: true, isHidden: true },
      });
      if (root && !root.isHidden) sharedFromAuthorId = root.userId;
    }
  }

  const hasMedia = !!(imageUrl || (imageUrls?.length) || videoUrl);
  // A share carries the original as its body, so an empty note is a complete post.
  if (!hasMedia && !sharedFromId && content.length < 1) {
    return NextResponse.json({ error: 'أضف نصاً أو صورة' }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: 'النص طويل جداً (5000 حرف كحد أقصى)' }, { status: 400 });
  }

  // Media URL domain validation
  const allImageUrls = [imageUrl, ...(imageUrls ?? []), thumbnailUrl].filter(Boolean) as string[];
  for (const u of allImageUrls) {
    if (!validateMediaUrl(u, 'image')) {
      return NextResponse.json({ error: 'رابط الصورة غير مسموح به' }, { status: 400 });
    }
  }
  if (videoUrl && !validateMediaUrl(videoUrl, 'video')) {
    return NextResponse.json({ error: 'رابط الفيديو غير مسموح به' }, { status: 400 });
  }

  // Saving as a draft rather than publishing. Everything else on this route is identical:
  // validation, the content filter and the media checks all run, so a draft cannot be used
  // as a way to store content that would be rejected on publish.
  const isDraft = body.isDraft === true;

  // Content filter
  const textToCheck = [content, title, summary].filter(Boolean).join(' ');
  const filterResult = filterContent(textToCheck);
  const autoHide = filterResult.flagged;

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
      ...(sharedFromId ? { sharedFromId } : {}),
      content,
      title,
      summary,
      category,
      tags: tags ?? undefined,
      imageUrl: imageUrl ?? (imageUrls?.[0] ?? null),
      imageUrls: imageUrls ?? undefined,
      imageAlt,
      isDraft,
      // Null while it is a draft; the publish route stamps it. Not reusing createdAt so a
      // post drafted last week and published today isn't buried a week deep.
      publishedAt: isDraft ? null : new Date(),
      videoUrl,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      userId: user.userId,
      authorName: dbUser?.name ?? 'مجهول',
      ...(seriesId ? { seriesId, seriesTitle: rawSeriesTitle, seriesOrder } : {}),
      ...(autoHide ? { isHidden: true, hiddenReason: filterResult.reason ?? 'auto-filter' } : {}),
    },
  });

  // `!isDraft`: a draft share must not bump the original's shareCount or tell its author
  // anything. Nothing has been shared yet — and a draft that is later discarded would have
  // left a permanent +1 and a notification about a post that never existed.
  if (sharedFromId && !isDraft) {
    // Best-effort: the share itself is already saved, so neither of these may fail it.
    prisma.tareeqPost.update({
      where: { id: sharedFromId },
      data: { shareCount: { increment: 1 } },
    }).catch(() => {});

    // Tell the author someone shared their mark — the whole point of attribution is that
    // it reaches them. Skip self-shares and anything auto-hidden (nothing to see yet).
    if (sharedFromAuthorId && !autoHide) {
      const sharerName = dbUser?.name ?? 'شخص ما';
      void notifyTareeq({
        userId: sharedFromAuthorId,
        type: 'share',
        actorId: user.userId,
        actorName: sharerName,
        actorAvatarUrl: dbUser?.avatarUrl ?? null,
        postId: post.id,
        postTitle: title ?? null,
        body: content.slice(0, 120) || null,
        // A share reaching its author is the entire point of attribution, and it was the
        // one notification with no push at all — so the author only learned about it by
        // opening the app.
        push: {
          title: 'طريق ★',
          body: `${sharerName} شارك علامتك 🔁`,
          url: `/tareeq/${post.id}`,
          tag: `share-${post.id}`,
          type: 'generic',
          postId: post.id,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, id: post.id, flagged: autoHide, isDraft });
}
