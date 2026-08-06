export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/tareeq/me — returns current user's liked, bookmarked post IDs, and reactions
export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ likedIds: [], bookmarkedIds: [], reactedPosts: {} });

  const [likes, bookmarks, reactions] = await Promise.all([
    prisma.tareeqLike.findMany({ where: { userId: user.userId }, select: { postId: true }, take: 500 }),
    prisma.tareeqBookmark.findMany({ where: { userId: user.userId }, select: { postId: true }, take: 500 }),
    prisma.tareeqReaction.findMany({ where: { userId: user.userId }, select: { postId: true, type: true }, take: 500 }),
  ]);

  const reactedPosts: Record<string, string> = {};
  for (const r of reactions) reactedPosts[r.postId] = r.type;

  return NextResponse.json({
    likedIds: likes.map((l: { postId: string }) => l.postId),
    bookmarkedIds: bookmarks.map((b: { postId: string }) => b.postId),
    reactedPosts,
  });
}
