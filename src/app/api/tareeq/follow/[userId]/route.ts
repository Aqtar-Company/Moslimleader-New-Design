export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET — check if current user follows this profile + counts
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const [followerCount, followingCount] = await Promise.all([
    prisma.tareeqFollow.count({ where: { followingId: params.userId } }),
    prisma.tareeqFollow.count({ where: { followerId: params.userId } }),
  ]);

  let isFollowing = false;
  try {
    const me = await getAuthUser();
    if (me) {
      const follow = await prisma.tareeqFollow.findUnique({
        where: { followerId_followingId: { followerId: me.userId, followingId: params.userId } },
      });
      isFollowing = !!follow;
    }
  } catch { /* not logged in */ }

  return NextResponse.json({ isFollowing, followerCount, followingCount });
}

// POST — toggle follow/unfollow
export async function POST(_req: NextRequest, { params }: { params: { userId: string } }) {
  const authResult = await getAuthUser().catch(() => null);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authResult;

  if (me.userId === params.userId) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

  const existing = await prisma.tareeqFollow.findUnique({
    where: { followerId_followingId: { followerId: me.userId, followingId: params.userId } },
  });

  if (existing) {
    await prisma.tareeqFollow.delete({ where: { id: existing.id } });
    return NextResponse.json({ following: false });
  } else {
    await prisma.tareeqFollow.create({ data: { followerId: me.userId, followingId: params.userId } });
    return NextResponse.json({ following: true });
  }
}
