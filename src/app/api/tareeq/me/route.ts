export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { getShared, setShared } from '@/lib/tareeq-store';

// GET /api/tareeq/me — returns current user's liked, bookmarked post IDs, reactions, and
// how many people they follow (the onboarding prompt keys off zero, and this endpoint is
// already fetched on every feed load — a separate request for one number would be waste).
export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ likedIds: [], bookmarkedIds: [], reactedPosts: {}, followingCount: 0, gender: null });

  // Gender rides along on a request the feed already makes. It decides whether pictures
  // are blurred for this viewer, so a separate round trip would mean every avatar on the
  // first screen renders unblurred and then blurs — showing exactly what it exists to veil.
  const [likes, bookmarks, reactions, followingCount, me] = await Promise.all([
    prisma.tareeqLike.findMany({ where: { userId: user.userId }, select: { postId: true }, take: 500 }),
    prisma.tareeqBookmark.findMany({ where: { userId: user.userId }, select: { postId: true }, take: 500 }),
    prisma.tareeqReaction.findMany({ where: { userId: user.userId }, select: { postId: true, type: true }, take: 500 }),
    prisma.tareeqFollow.count({ where: { followerId: user.userId } }),
    prisma.user.findUnique({ where: { id: user.userId }, select: { tareeqGender: true, tareeqProfileLocked: true } }),
  ]);

  const reactedPosts: Record<string, string> = {};
  for (const r of reactions) reactedPosts[r.postId] = r.type;

  /**
   * Mark that this member uses طريق.
   *
   * `tareeqLastSeen` was written from ONE place: the direct-message screen's heartbeat. So
   * somebody who signed up, posted, reacted and commented but never opened a private chat
   * had it left null — and that column is what «مستخدمو طريق» in the admin panel filters
   * on, what the admin stats count, and what the broadcast audience uses to tell a طريق
   * member from a shop-only customer. Active members were invisible in the panel and were
   * being left out of messages addressed to طريق's own members.
   *
   * Here instead, because this endpoint is fetched on every feed load — which is the
   * thing that actually means "is using طريق" — and throttled on the same five-minute key
   * the heartbeat uses, so the two together still write to the User row at most once every
   * five minutes. That table also serves the shop's sign-in, orders and membership, and
   * the throttle is why the heartbeat was moved off it in the first place.
   */
  void (async () => {
    const key = `presence-db:${user.userId}`;
    if (await getShared(key)) return;
    await setShared(key, '1', 300);
    await prisma.user.update({
      where: { id: user.userId },
      data: { tareeqLastSeen: new Date() },
    }).catch(() => {});
  })();

  return NextResponse.json({
    likedIds: likes.map((l: { postId: string }) => l.postId),
    bookmarkedIds: bookmarks.map((b: { postId: string }) => b.postId),
    reactedPosts,
    followingCount,
    gender: me?.tareeqGender ?? null,
    profileLocked: me?.tareeqProfileLocked ?? false,
  });
}
