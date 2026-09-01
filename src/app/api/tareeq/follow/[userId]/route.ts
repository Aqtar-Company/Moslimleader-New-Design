export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended, isBlockedEitherWay } from '@/lib/tareeq-guard';
import { sendPushToUser } from '@/lib/tareeq-push';

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

  const rl = tareeqRateLimit('follow', me.userId, 30, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(me.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  if (me.userId === params.userId) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

  const existing = await prisma.tareeqFollow.findUnique({
    where: { followerId_followingId: { followerId: me.userId, followingId: params.userId } },
  });

  if (existing) {
    // deleteMany is idempotent — avoids P2025 on concurrent unfollow
    await prisma.tareeqFollow.deleteMany({ where: { followerId: me.userId, followingId: params.userId } });
    return NextResponse.json({ following: false });
  } else {
    // Blocking severs an EXISTING follow, but nothing stopped either side
    // from immediately re-following right after — check it here too.
    if (await isBlockedEitherWay(me.userId, params.userId)) {
      return NextResponse.json({ error: 'لا يمكن متابعة هذا المستخدم' }, { status: 403 });
    }
    try {
      await prisma.tareeqFollow.create({ data: { followerId: me.userId, followingId: params.userId } });
    } catch (e: any) {
      // P2002 = unique constraint — concurrent request already created the follow
      if (e?.code === 'P2002') return NextResponse.json({ following: true });
      throw e;
    }
    // New followers were previously invisible — no notification was ever
    // created here, so growth's most basic feedback signal never fired.
    const actor = await prisma.user.findUnique({ where: { id: me.userId }, select: { name: true, avatarUrl: true } });
    const actorName = actor?.name ?? 'شخص ما';
    prisma.tareeqNotification.create({
      data: {
        userId: params.userId,
        type: 'follow',
        actorId: me.userId,
        actorName,
        actorAvatarUrl: actor?.avatarUrl ?? null,
      },
    }).catch(() => {});
    sendPushToUser(params.userId, {
      title: 'طريق ★',
      body: `${actorName} بدأ متابعتك`,
      url: `/tareeq/u/${me.userId}`,
      tag: `follow-${me.userId}`,
      type: 'generic',
    }).catch(() => {});
    return NextResponse.json({ following: true });
  }
}
