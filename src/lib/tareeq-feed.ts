/**
 * The «لك» feed's server side, shared by the API route (`/api/tareeq?sort=foryou`) and the
 * server-rendered first page (`src/app/tareeq/page.tsx`).
 *
 * It lives here and not in the route because the FIRST page is rendered by the page, not
 * fetched by the client: while the ranking existed only in the route, the tab said «لك»
 * and the screen showed the newest-first list the page rendered — with no hidden, muted or
 * blocked filter, so a post the reader had just hidden came straight back on reload.
 *
 * Scoring is in `tareeq-feed-rank.ts`; this file gathers the inputs, caches the ranked
 * order, and pages over it.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { SHARED_FROM_SELECT, normalizeSharedFrom } from '@/lib/tareeq-post-select';
import { postSearchWhere } from '@/lib/tareeq-search';
import { getShared, setShared } from '@/lib/tareeq-store';
import { FOR_YOU_POOL, FOR_YOU_WINDOW_DAYS, diversify, parseForYouCursor, scoreForReader } from '@/lib/tareeq-feed-rank';

export type FeedExclusions = {
  /** Either direction of a block. Never visible anywhere. */
  blockedIds: string[];
  /** People the viewer muted — out of the feeds, not out of their own page. */
  mutedIds: string[];
  /** Single posts the viewer hid (TareeqHiddenPost). */
  hiddenPostIds: string[];
};

export async function loadFeedExclusions(viewerId: string | null): Promise<FeedExclusions> {
  if (!viewerId) return { blockedIds: [], mutedIds: [], hiddenPostIds: [] };
  const [blocks, mutes, hidden] = await Promise.all([
    prisma.tareeqBlock.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.tareeqMute.findMany({
      where: { muterId: viewerId, mutedId: { not: null } },
      select: { mutedId: true },
    }),
    // Best-effort: a failure here (the table not pushed yet on a half-finished deploy)
    // must cost the feature, never the feed.
    prisma.tareeqHiddenPost.findMany({
      where: { userId: viewerId },
      select: { postId: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }).catch(() => [] as { postId: string }[]),
  ]);
  return {
    blockedIds: blocks.map(b => (b.blockerId === viewerId ? b.blockedId : b.blockerId)),
    mutedIds: mutes.map(m => m.mutedId!).filter(Boolean),
    hiddenPostIds: hidden.map(h => h.postId),
  };
}

export const FEED_POST_SELECT = {
  id: true, title: true, summary: true, content: true,
  category: true, tags: true, imageUrl: true, imageAlt: true, imageUrls: true, videoUrl: true, thumbnailUrl: true, authorName: true,
  likeCount: true, commentCount: true, savedCount: true, createdAt: true, userId: true,
  pinnedCommentId: true, postUpdate: true, postUpdateAt: true,
  seriesId: true, seriesTitle: true, seriesOrder: true,
  ...SHARED_FROM_SELECT,
  user: { select: { id: true, name: true, avatarUrl: true, tareeqGender: true } },
  reactions: { distinct: ['type'], orderBy: { createdAt: 'desc' }, select: { type: true }, take: 40 },
} satisfies Prisma.TareeqPostSelect;

type Where = Prisma.TareeqPostWhereInput;

async function fetchFeedRows(where: Where, extra: Omit<Prisma.TareeqPostFindManyArgs, 'where' | 'select' | 'include'> = {}) {
  return prisma.tareeqPost.findMany({ where, ...extra, select: FEED_POST_SELECT });
}
type FeedRow = Awaited<ReturnType<typeof fetchFeedRows>>[number];

export function shapeFeedRows(rows: FeedRow[]) {
  return rows.map(p => ({
    ...p,
    topReactions: p.reactions.map((r: { type: string }) => r.type),
    reactions: undefined,
    sharedFrom: normalizeSharedFrom(p.sharedFrom),
  }));
}

/** The ranked order for one snapshot, cached so every page reads the SAME list. */
type RankedList = { ids: string[]; tail: string | null };

const RANK_TTL_SECONDS = 30 * 60;
/** Signed-out readers all see the same ranking, so they share one list per 5 minutes. */
const ANON_SNAPSHOT_MS = 5 * 60 * 1000;

export async function forYouPage(opts: {
  viewerId: string | null;
  category?: string;
  search?: string;
  cursor?: string;
  limit: number;
  excl: FeedExclusions;
}): Promise<{ posts: ReturnType<typeof shapeFeedRows>; nextCursor: string | null }> {
  const { viewerId, category, search, limit, excl } = opts;
  const parsed = parseForYouCursor(opts.cursor);

  const exclusionAnd: Where[] = [
    ...(excl.blockedIds.length ? [{ userId: { notIn: excl.blockedIds } }] : []),
    ...(excl.mutedIds.length ? [{ userId: { notIn: excl.mutedIds } }] : []),
    ...(excl.hiddenPostIds.length ? [{ id: { notIn: excl.hiddenPostIds } }] : []),
  ];
  const baseWhere: Where = {
    isHidden: false,
    isDraft: false,
    ...(category ? { category } : {}),
    ...postSearchWhere(search),
  };

  // ── Past the ranked window: chronological ────────────────────────────────────────
  if (parsed?.kind === 'old') {
    const rows = await fetchFeedRows(
      { ...baseWhere, AND: [...exclusionAnd, { createdAt: { lt: new Date(parsed.boundary) } }] },
      {
        orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
        take: limit + 1,
        ...(parsed.afterId ? { cursor: { id: parsed.afterId }, skip: 1 } : {}),
      },
    );
    const more = rows.length > limit;
    const items = shapeFeedRows(more ? rows.slice(0, limit) : rows);
    return { posts: items, nextCursor: more ? `fyold:${parsed.boundary}:${items[items.length - 1].id}` : null };
  }

  // ── The ranked window ────────────────────────────────────────────────────────────
  const now = Date.now();
  const snapshot = parsed?.kind === 'ranked'
    ? parsed.snapshot
    : viewerId ? now : Math.floor(now / ANON_SNAPSHOT_MS) * ANON_SNAPSHOT_MS;
  const offset = parsed?.kind === 'ranked' ? parsed.offset : 0;
  const cacheKey = `tareeq:fy:${viewerId ?? 'anon'}:${snapshot}:${category ?? ''}:${(search ?? '').slice(0, 80)}`;

  let list: RankedList | null = null;
  try {
    const raw = await getShared(cacheKey);
    if (raw) list = JSON.parse(raw) as RankedList;
  } catch { /* recompute */ }

  if (!list) {
    list = await rankForYou({ viewerId, snapshot, baseWhere, exclusionAnd });
    // Best-effort: without the cache each page re-ranks, which is slower but correct
    // enough (the snapshot still pins the candidate set).
    void setShared(cacheKey, JSON.stringify(list), RANK_TTL_SECONDS).catch(() => {});
  }

  const pageIds = list.ids.slice(offset, offset + limit);
  // Re-check the CURRENT exclusions on the page itself: a post hidden or an author muted
  // since the list was built drops out here — and only here, so later offsets do not move
  // and nothing is skipped. That is the reason for caching the list at all: re-ranking per
  // page let every hide, mute or reaction shift the order under the reader and skip posts.
  const rows = pageIds.length
    ? await fetchFeedRows({ ...baseWhere, id: { in: pageIds }, AND: exclusionAnd })
    : [];
  const byId = new Map(rows.map(r => [r.id, r]));
  const items = shapeFeedRows(pageIds.map(id => byId.get(id)).filter((r): r is FeedRow => !!r));

  const nextCursor = offset + limit < list.ids.length ? `fy:${snapshot}:${offset + limit}` : list.tail;
  return { posts: items, nextCursor };
}

async function rankForYou(args: {
  viewerId: string | null;
  snapshot: number;
  baseWhere: Where;
  exclusionAnd: Where[];
}): Promise<RankedList> {
  const { viewerId, snapshot, baseWhere, exclusionAnd } = args;
  const snap = new Date(snapshot);
  const windowStart = new Date(snapshot - FOR_YOU_WINDOW_DAYS * 24 * 3600 * 1000);

  const candidates = await prisma.tareeqPost.findMany({
    where: {
      ...baseWhere,
      AND: [
        ...exclusionAnd,
        // In the window by PUBLICATION, not creation: a draft written a month ago and
        // published today is today's post. Old rows predate `publishedAt` and use createdAt.
        { OR: [
          { publishedAt: { gte: windowStart, lte: snap } },
          { publishedAt: null, createdAt: { gte: windowStart, lte: snap } },
        ] },
      ],
    },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: FOR_YOU_POOL,
    select: {
      id: true, userId: true, createdAt: true, publishedAt: true,
      likeCount: true, commentCount: true, savedCount: true, shareCount: true,
      imageUrl: true, videoUrl: true,
    },
  });

  // The reader's signals, all as of the snapshot. Each is best-effort: a failed query
  // ranks without that signal rather than failing the feed.
  const following = new Set<string>();
  const affinity = new Map<string, number>();
  const seen = new Set<string>();
  if (viewerId && candidates.length) {
    const since = new Date(snapshot - 60 * 24 * 3600 * 1000);
    const ids = candidates.map(c => c.id);
    const [follows, myReactions, myComments, views, reactedHere] = await Promise.all([
      prisma.tareeqFollow.findMany({ where: { followerId: viewerId, createdAt: { lte: snap } }, select: { followingId: true } }).catch(() => []),
      prisma.tareeqReaction.findMany({
        where: { userId: viewerId, createdAt: { gte: since, lte: snap } },
        orderBy: { createdAt: 'desc' }, take: 500,
        select: { post: { select: { userId: true } } },
      }).catch(() => []),
      prisma.tareeqComment.findMany({
        where: { userId: viewerId, createdAt: { gte: since, lte: snap } },
        orderBy: { createdAt: 'desc' }, take: 300,
        select: { post: { select: { userId: true } } },
      }).catch(() => []),
      prisma.tareeqPostView.findMany({
        where: { userId: viewerId, postId: { in: ids }, createdAt: { lt: snap } },
        select: { postId: true },
      }).catch(() => []),
      prisma.tareeqReaction.findMany({
        where: { userId: viewerId, postId: { in: ids }, createdAt: { lt: snap } },
        select: { postId: true },
      }).catch(() => []),
    ]);
    for (const f of follows) following.add(f.followingId);
    for (const r of [...myReactions, ...myComments]) {
      const a = r.post?.userId;
      if (a && a !== viewerId) affinity.set(a, (affinity.get(a) ?? 0) + 1);
    }
    for (const v of views) seen.add(v.postId);
    for (const r of reactedHere) seen.add(r.postId);
  }

  const signals = { viewerId, following, affinity, seen };
  const ranked = diversify(
    candidates
      .map(c => ({ ...c, score: scoreForReader(c, signals, snapshot) }))
      .sort((a, b) => b.score - a.score || (a.id < b.id ? 1 : -1)),
  );

  // Where the chronological tail starts. Normally the window's own start. When the pool
  // cap cut the window short, it is the last candidate itself — `(createdAt, id)`, not
  // createdAt alone, so posts sharing that millisecond but cut by `take` are not skipped.
  let tail: string | null;
  if (candidates.length >= FOR_YOU_POOL) {
    const last = candidates[candidates.length - 1];
    tail = `fyold:${last.createdAt.getTime() + 1}:${last.id}`;
  } else {
    const older = await prisma.tareeqPost.findFirst({
      where: { ...baseWhere, AND: [...exclusionAnd, { createdAt: { lt: windowStart } }] },
      select: { id: true },
    });
    tail = older ? `fyold:${windowStart.getTime()}` : null;
  }

  return { ids: ranked.map(r => r.id), tail };
}
