/**
 * Comments and reactions on media items — the reads and the rules, shared by the API and
 * the server-rendered pages. Server-only.
 */
import { prisma } from '@/lib/prisma';
import { MEDIA_REACTION_TYPES } from '@/lib/free-media-shared';

export type ReactionSummary = { counts: Record<string, number>; total: number; mine: string | null };
export type PublicComment = {
  /** A طريق comment's cuid, or — for an item not yet bridged to طريق — the legacy row's
   *  number as a string. The delete route tells them apart by shape. */
  id: string; content: string; createdAt: string;
  /** First name only, and no photo: this is a public page, and طريق veils a woman's picture
   *  from men — a comment here must not show what the platform itself would not. */
  user: { id: string; name: string };
};

export function firstName(full: string | null | undefined): string {
  const w = (full ?? '').trim().split(/\s+/)[0];
  return w || 'عضو';
}

/** طريق's own limit for a comment — the comment IS a طريق comment now, and its edit route
 *  refuses anything longer. */
export const COMMENT_MAX = 500;
export const isReactionType = (t: unknown): t is typeof MEDIA_REACTION_TYPES[number] =>
  typeof t === 'string' && (MEDIA_REACTION_TYPES as readonly string[]).includes(t);

/**
 * Which items are bridged to طريق, and their post. An item with a discussion post reads
 * ONLY from it: the legacy rows were moved into it when it was made (media-tareeq.ts).
 */
async function discussionPosts(mediaIds: number[]): Promise<Map<number, string>> {
  if (!mediaIds.length) return new Map();
  const rows = await prisma.freeMedia.findMany({
    where: { id: { in: mediaIds }, discussionPostId: { not: null } },
    select: { id: true, discussionPostId: true },
  });
  return new Map(rows.map(r => [r.id, r.discussionPostId!]));
}

/** Reaction counts per item, and the viewer's own. Grouped queries, not one per item. */
export async function reactionSummaries(mediaIds: number[], viewerId: string | null): Promise<Map<number, ReactionSummary>> {
  const out = new Map<number, ReactionSummary>();
  for (const id of mediaIds) out.set(id, { counts: {}, total: 0, mine: null });
  if (!mediaIds.length) return out;
  const posts = await discussionPosts(mediaIds);
  const legacyIds = mediaIds.filter(id => !posts.has(id));
  const postIds = Array.from(posts.values());
  const mediaOfPost = new Map(Array.from(posts.entries()).map(([m, p]) => [p, m]));

  const [groups, mine, tGroups, tMine] = await Promise.all([
    legacyIds.length
      ? prisma.freeMediaReaction.groupBy({ by: ['mediaId', 'type'], where: { mediaId: { in: legacyIds } }, _count: { _all: true } })
      : Promise.resolve([] as { mediaId: number; type: string; _count: { _all: number } }[]),
    viewerId && legacyIds.length
      ? prisma.freeMediaReaction.findMany({ where: { mediaId: { in: legacyIds }, userId: viewerId }, select: { mediaId: true, type: true } })
      : Promise.resolve([] as { mediaId: number; type: string }[]),
    postIds.length
      ? prisma.tareeqReaction.groupBy({ by: ['postId', 'type'], where: { postId: { in: postIds } }, _count: { _all: true } })
      : Promise.resolve([] as { postId: string; type: string; _count: { _all: number } }[]),
    viewerId && postIds.length
      ? prisma.tareeqReaction.findMany({ where: { postId: { in: postIds }, userId: viewerId }, select: { postId: true, type: true } })
      : Promise.resolve([] as { postId: string; type: string }[]),
  ]);
  const add = (mediaId: number | undefined, type: string, n: number) => {
    const s = mediaId !== undefined ? out.get(mediaId) : undefined;
    if (!s) return;
    s.counts[type] = (s.counts[type] ?? 0) + n;
    s.total += n;
  };
  for (const g of groups) add(g.mediaId, g.type, g._count._all);
  for (const g of tGroups) add(mediaOfPost.get(g.postId), g.type, g._count._all);
  for (const m of mine) out.get(m.mediaId)!.mine = m.type;
  for (const m of tMine) { const id = mediaOfPost.get(m.postId); if (id !== undefined) out.get(id)!.mine = m.type; }
  return out;
}

/** Visible top-level comment counts per item (what طريق's own counter counts). */
export async function commentCounts(mediaIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>(mediaIds.map(id => [id, 0]));
  if (!mediaIds.length) return out;
  const posts = await discussionPosts(mediaIds);
  const legacyIds = mediaIds.filter(id => !posts.has(id));
  const mediaOfPost = new Map(Array.from(posts.entries()).map(([m, p]) => [p, m]));
  const [legacy, tareeq] = await Promise.all([
    legacyIds.length
      ? prisma.freeMediaComment.groupBy({ by: ['mediaId'], where: { mediaId: { in: legacyIds }, isHidden: false }, _count: { _all: true } })
      : Promise.resolve([] as { mediaId: number; _count: { _all: number } }[]),
    posts.size
      ? prisma.tareeqComment.groupBy({ by: ['postId'], where: { postId: { in: Array.from(posts.values()) }, isHidden: false, parentId: null }, _count: { _all: true } })
      : Promise.resolve([] as { postId: string; _count: { _all: number } }[]),
  ]);
  for (const g of legacy) out.set(g.mediaId, g._count._all);
  for (const g of tareeq) { const id = mediaOfPost.get(g.postId); if (id !== undefined) out.set(id, g._count._all); }
  return out;
}

async function firstNames(userIds: string[]): Promise<Map<string, string>> {
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: Array.from(new Set(userIds)) } }, select: { id: true, name: true } })
    : [];
  return new Map(users.map(u => [u.id, firstName(u.name)]));
}

/**
 * Newest first, `limit` at a time. `before` is the opaque cursor the previous page returned.
 * For a bridged item these are the طريق post's top-level comments; replies stay in طريق,
 * where they make sense under the comment they answer — `postId` is returned for the link.
 */
export async function loadComments(mediaId: number, opts: { before?: string; limit?: number } = {}): Promise<{ comments: PublicComment[]; nextBefore: string | null; postId: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const postId = (await discussionPosts([mediaId])).get(mediaId) ?? null;

  if (postId) {
    let cursorWhere = {};
    if (opts.before) {
      const ref = await prisma.tareeqComment.findUnique({ where: { id: opts.before }, select: { createdAt: true, id: true } });
      if (ref) cursorWhere = { OR: [{ createdAt: { lt: ref.createdAt } }, { createdAt: ref.createdAt, id: { lt: ref.id } }] };
    }
    const rows = await prisma.tareeqComment.findMany({
      where: { postId, isHidden: false, parentId: null, ...cursorWhere },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, content: true, createdAt: true, userId: true },
    });
    const more = rows.length > limit;
    const page = more ? rows.slice(0, limit) : rows;
    const names = await firstNames(page.map(r => r.userId));
    return {
      comments: page.map(r => ({
        id: r.id, content: r.content, createdAt: r.createdAt.toISOString(),
        user: { id: r.userId, name: names.get(r.userId) ?? 'عضو' },
      })),
      nextBefore: more ? page[page.length - 1].id : null,
      postId,
    };
  }

  const beforeId = Number(opts.before);
  const rows = await prisma.freeMediaComment.findMany({
    where: { mediaId, isHidden: false, ...(Number.isInteger(beforeId) && beforeId > 0 ? { id: { lt: beforeId } } : {}) },
    orderBy: { id: 'desc' },
    take: limit + 1,
    select: { id: true, content: true, createdAt: true, userId: true },
  });
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  const names = await firstNames(page.map(r => r.userId));
  return {
    comments: page.map(r => ({
      id: String(r.id), content: r.content, createdAt: r.createdAt.toISOString(),
      user: { id: r.userId, name: names.get(r.userId) ?? 'عضو' },
    })),
    nextBefore: more ? String(page[page.length - 1].id) : null,
    postId: null,
  };
}
