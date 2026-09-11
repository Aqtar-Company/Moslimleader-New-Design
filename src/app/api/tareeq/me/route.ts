export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/tareeq/me — returns current user's liked, bookmarked post IDs, reactions, and
// how many people they follow (the onboarding prompt keys off zero, and this endpoint is
// already fetched on every feed load — a separate request for one number would be waste).
export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ likedIds: [], bookmarkedIds: [], reactedPosts: {}, followingCount: 0 });

  const [likes, bookmarks, reactions, followingCount] = await Promise.all([
    prisma.tareeqLike.findMany({ where: { userId: user.userId }, select: { postId: true }, take: 500 }),
    prisma.tareeqBookmark.findMany({ where: { userId: user.userId }, select: { postId: true }, take: 500 }),
    prisma.tareeqReaction.findMany({ where: { userId: user.userId }, select: { postId: true, type: true }, take: 500 }),
    prisma.tareeqFollow.count({ where: { followerId: user.userId } }),
  ]);

  const reactedPosts: Record<string, string> = {};
  for (const r of reactions) reactedPosts[r.postId] = r.type;

  return NextResponse.json({
    likedIds: likes.map((l: { postId: string }) => l.postId),
    bookmarkedIds: bookmarks.map((b: { postId: string }) => b.postId),
    reactedPosts,
    followingCount,
  });
}
