export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/tareeq/follow/[userId]/list?type=followers|following
// Returns list of followers or following with mutual-follow status for current user
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const type = req.nextUrl.searchParams.get('type') ?? 'followers';
  if (type !== 'followers' && type !== 'following') {
    return NextResponse.json({ error: 'type must be followers or following' }, { status: 400 });
  }

  let me: { userId: string } | null = null;
  try { me = await getAuthUser(); } catch { /* not logged in */ }

  const follows = await prisma.tareeqFollow.findMany({
    where: type === 'followers'
      ? { followingId: params.userId }
      : { followerId: params.userId },
    include: {
      follower: { select: { id: true, name: true, username: true, avatarUrl: true } },
      following: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const users = follows.map(f => type === 'followers' ? f.follower : f.following);

  // Check which of these users the current viewer follows
  let viewerFollowingIds = new Set<string>();
  if (me) {
    const myFollows = await prisma.tareeqFollow.findMany({
      where: { followerId: me.userId, followingId: { in: users.map(u => u.id) } },
      select: { followingId: true },
    });
    viewerFollowingIds = new Set(myFollows.map(f => f.followingId));
  }

  return NextResponse.json({
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      username: (u as { username?: string | null }).username ?? null,
      avatarUrl: u.avatarUrl,
      isFollowedByViewer: viewerFollowingIds.has(u.id),
    })),
  });
}
