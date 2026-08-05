export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/tareeq/me — returns current user's liked and bookmarked post IDs
export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ likedIds: [], bookmarkedIds: [] });

  const [likes, bookmarks] = await Promise.all([
    prisma.tareeqLike.findMany({ where: { userId: user.userId }, select: { postId: true }, take: 500 }),
    prisma.tareeqBookmark.findMany({ where: { userId: user.userId }, select: { postId: true }, take: 500 }),
  ]);

  return NextResponse.json({
    likedIds: likes.map(l => l.postId),
    bookmarkedIds: bookmarks.map(b => b.postId),
  });
}
