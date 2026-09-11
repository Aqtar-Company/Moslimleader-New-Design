export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

/**
 * Who and what the signed-in user has muted.
 *
 * A mute is invisible to the muted person, which makes it invisible to the muter too
 * unless there is a list to review. Without this, a mute made months ago is unexplainable
 * silence — the user sees someone has "stopped posting" and cannot find out why.
 */
export async function GET() {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ users: [], posts: [] });

  const mutes = await prisma.tareeqMute.findMany({
    where: { muterId: me.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, postId: true, createdAt: true,
      muted: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    users: mutes
      .filter(m => m.muted)
      .map(m => ({ id: m.muted!.id, name: m.muted!.name, avatarUrl: m.muted!.avatarUrl, mutedAt: m.createdAt.toISOString() })),
    posts: mutes.filter(m => m.postId).map(m => ({ postId: m.postId!, mutedAt: m.createdAt.toISOString() })),
  });
}
