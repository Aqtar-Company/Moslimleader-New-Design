/**
 * Comments and reactions on media items — the reads and the rules, shared by the API and
 * the server-rendered pages. Server-only.
 */
import { prisma } from '@/lib/prisma';
import { MEDIA_REACTION_TYPES } from '@/lib/free-media-shared';

export type ReactionSummary = { counts: Record<string, number>; total: number; mine: string | null };
export type PublicComment = {
  id: number; content: string; createdAt: string;
  /** First name only, and no photo: this is a public page, and طريق veils a woman's picture
   *  from men — a comment here must not show what the platform itself would not. */
  user: { id: string; name: string };
};

export function firstName(full: string | null | undefined): string {
  const w = (full ?? '').trim().split(/\s+/)[0];
  return w || 'عضو';
}

export const COMMENT_MAX = 1000;
export const isReactionType = (t: unknown): t is typeof MEDIA_REACTION_TYPES[number] =>
  typeof t === 'string' && (MEDIA_REACTION_TYPES as readonly string[]).includes(t);

/** Reaction counts per item, and the viewer's own reaction. One grouped query, not one per item. */
export async function reactionSummaries(mediaIds: number[], viewerId: string | null): Promise<Map<number, ReactionSummary>> {
  const out = new Map<number, ReactionSummary>();
  for (const id of mediaIds) out.set(id, { counts: {}, total: 0, mine: null });
  if (!mediaIds.length) return out;
  const [groups, mine] = await Promise.all([
    prisma.freeMediaReaction.groupBy({ by: ['mediaId', 'type'], where: { mediaId: { in: mediaIds } }, _count: { _all: true } }),
    viewerId
      ? prisma.freeMediaReaction.findMany({ where: { mediaId: { in: mediaIds }, userId: viewerId }, select: { mediaId: true, type: true } })
      : Promise.resolve([] as { mediaId: number; type: string }[]),
  ]);
  for (const g of groups) {
    const s = out.get(g.mediaId)!;
    s.counts[g.type] = g._count._all;
    s.total += g._count._all;
  }
  for (const m of mine) out.get(m.mediaId)!.mine = m.type;
  return out;
}

/** Visible comment counts per item. */
export async function commentCounts(mediaIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>(mediaIds.map(id => [id, 0]));
  if (!mediaIds.length) return out;
  const groups = await prisma.freeMediaComment.groupBy({
    by: ['mediaId'], where: { mediaId: { in: mediaIds }, isHidden: false }, _count: { _all: true },
  });
  for (const g of groups) out.set(g.mediaId, g._count._all);
  return out;
}

/** Newest first, `limit` at a time, with each writer's name and picture joined by hand. */
export async function loadComments(mediaId: number, opts: { beforeId?: number; limit?: number } = {}): Promise<{ comments: PublicComment[]; nextBefore: number | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const rows = await prisma.freeMediaComment.findMany({
    where: { mediaId, isHidden: false, ...(opts.beforeId ? { id: { lt: opts.beforeId } } : {}) },
    orderBy: { id: 'desc' },
    take: limit + 1,
    select: { id: true, content: true, createdAt: true, userId: true },
  });
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(page.map(r => r.userId))) } },
    select: { id: true, name: true },
  });
  const byId = new Map(users.map(u => [u.id, u]));
  return {
    comments: page.map(r => {
      const u = byId.get(r.userId);
      return {
        id: r.id, content: r.content, createdAt: r.createdAt.toISOString(),
        user: { id: r.userId, name: firstName(u?.name) },
      };
    }),
    nextBefore: more ? page[page.length - 1].id : null,
  };
}
