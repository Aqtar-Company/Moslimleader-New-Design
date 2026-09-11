export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { TAREEQ_CATEGORIES } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';

/**
 * Accounts worth following, optionally within chosen interests.
 *
 * This is the gap that decided whether Tareeq keeps anyone: a new member arrived on a feed
 * they followed nobody in, and there was nothing suggesting a single account. The widget
 * the code itself called `Suggested users widget` suggested no users — it was four static
 * links to the category pages.
 *
 * Ranked by how much the author has actually published in the chosen categories, recent
 * work first. Not by follower count: that would freeze the same handful of accounts at the
 * top forever, and on a platform this size the effect is immediate.
 *
 * GET /api/tareeq/suggestions?categories=experience,story&limit=5
 */

const WINDOW_DAYS = 120;
const MAX_LIMIT = 10;

export async function GET(req: NextRequest) {
  const me = await getAuthUser().catch(() => null);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit') ?? '5')));
  const cats = (searchParams.get('categories') ?? '')
    .split(',')
    .map(c => c.trim())
    .filter((c): c is TareeqCategoryKey => c in TAREEQ_CATEGORIES);

  // Everyone already connected to the viewer is excluded: following them again is not a
  // suggestion, and a blocked or muted account being "suggested" would be absurd.
  const excluded = new Set<string>();
  if (me) {
    excluded.add(me.userId);
    const [follows, blocks, mutes] = await Promise.all([
      prisma.tareeqFollow.findMany({ where: { followerId: me.userId }, select: { followingId: true } }),
      prisma.tareeqBlock.findMany({
        where: { OR: [{ blockerId: me.userId }, { blockedId: me.userId }] },
        select: { blockerId: true, blockedId: true },
      }),
      prisma.tareeqMute.findMany({
        where: { muterId: me.userId, mutedId: { not: null } },
        select: { mutedId: true },
      }),
    ]);
    for (const f of follows) excluded.add(f.followingId);
    for (const b of blocks) { excluded.add(b.blockerId); excluded.add(b.blockedId); }
    for (const m of mutes) if (m.mutedId) excluded.add(m.mutedId);
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  // groupBy on the posts, not a join from users: the ranking IS "who published here",
  // so the posts table is the right side to count from.
  const rows = await prisma.tareeqPost.groupBy({
    by: ['userId'],
    where: {
      isHidden: false,
      isDraft: false,
      createdAt: { gte: since },
      userId: { not: null },
      ...(cats.length ? { category: { in: cats } } : {}),
    },
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    // Over-fetch: the exclusions below are applied after ranking, and a viewer who
    // already follows the top authors would otherwise get a short or empty list.
    take: (limit + excluded.size) * 2 + 20,
  });

  const ids = rows
    .map(r => r.userId)
    .filter((id): id is string => !!id && !excluded.has(id))
    .slice(0, limit);

  if (!ids.length) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    // A suspended account must never be recommended — it is the one place the platform
    // actively puts an account in front of someone.
    where: { id: { in: ids }, tareeqSuspended: false },
    select: { id: true, name: true, username: true, avatarUrl: true },
  });

  const counts = new Map(rows.map(r => [r.userId, r._count.userId]));
  // findMany does not preserve the `in` order, so the ranking is reapplied here.
  const ordered = users
    .map(u => ({ ...u, postCount: counts.get(u.id) ?? 0 }))
    .sort((a, b) => b.postCount - a.postCount);

  return NextResponse.json({ users: ordered });
}
