export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

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
  const ip = _req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-follow:${ip}`, 30, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const authResult = await getAuthUser().catch(() => null);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authResult;

  if (me.userId === params.userId) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

  const existing = await prisma.tareeqFollow.findUnique({
    where: { followerId_followingId: { followerId: me.userId, followingId: params.userId } },
  });

  if (existing) {
    // deleteMany is idempotent — avoids P2025 on concurrent unfollow
    await prisma.tareeqFollow.deleteMany({ where: { followerId: me.userId, followingId: params.userId } });
    return NextResponse.json({ following: false });
  } else {
    try {
      await prisma.tareeqFollow.create({ data: { followerId: me.userId, followingId: params.userId } });
    } catch (e: any) {
      // P2002 = unique constraint — concurrent request already created the follow
      if (e?.code === 'P2002') return NextResponse.json({ following: true });
      throw e;
    }
    return NextResponse.json({ following: true });
  }
}
