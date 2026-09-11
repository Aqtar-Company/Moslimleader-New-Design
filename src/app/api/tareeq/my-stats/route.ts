export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

/**
 * What the author's own writing actually did.
 *
 * `viewCount`, `likeCount`, `commentCount`, `savedCount` and `shareCount` were all
 * maintained on every post and shown nowhere the author could see them together. A
 * platform that never shows a writer their effect treats them as a data-entry clerk —
 * and on a platform built on written experience, the writer continuing is the product.
 */
export async function GET() {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ totals: null, posts: [] });

  const [posts, followers, agg] = await Promise.all([
    prisma.tareeqPost.findMany({
      where: { userId: me.userId, isDraft: false },
      orderBy: { viewCount: 'desc' },
      take: 20,
      select: {
        id: true, title: true, content: true, createdAt: true,
        viewCount: true, likeCount: true, commentCount: true, savedCount: true, shareCount: true,
      },
    }),
    prisma.tareeqFollow.count({ where: { followingId: me.userId } }),
    // Summed in the database rather than over the 20 rows above: the totals must cover
    // everything the author wrote, not just their twenty most-read posts.
    prisma.tareeqPost.aggregate({
      where: { userId: me.userId, isDraft: false },
      _count: { id: true },
      _sum: { viewCount: true, likeCount: true, commentCount: true, savedCount: true, shareCount: true },
    }),
  ]);

  return NextResponse.json({
    totals: {
      posts: agg._count.id,
      followers,
      views: agg._sum.viewCount ?? 0,
      reactions: agg._sum.likeCount ?? 0,
      comments: agg._sum.commentCount ?? 0,
      saves: agg._sum.savedCount ?? 0,
      shares: agg._sum.shareCount ?? 0,
    },
    posts: posts.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      title: p.title ?? p.content.slice(0, 70),
      content: undefined,
    })),
  });
}
