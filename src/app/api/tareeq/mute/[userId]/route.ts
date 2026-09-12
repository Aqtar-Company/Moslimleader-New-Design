export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';

/**
 * Mute and unmute a person — the quiet counterpart to `/api/tareeq/block/[userId]`.
 *
 * A block severs both directions and the other side can tell. In a community where people
 * know each other that cost is high enough that nobody uses it, so they put up with the
 * noise or they leave. A mute is one-directional and invisible to the muted: their posts
 * leave your feed and their actions stop notifying you, and nothing tells them.
 *
 * Deliberately NOT symmetric with block: muting does not stop them seeing you, does not
 * stop DMs, and does not hide your posts from them. It is about your feed, not theirs.
 */
export async function POST(_req: NextRequest, { params }: { params: { userId: string } }) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (params.userId === me.userId) {
    return NextResponse.json({ error: 'cannot mute yourself' }, { status: 400 });
  }

  const rl = await tareeqRateLimit('mute', me.userId, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  try {
    await prisma.tareeqMute.create({ data: { muterId: me.userId, mutedId: params.userId } });
  } catch (e: unknown) {
    // P2002 = already muted. Idempotent by design: the button must not fail on a double tap.
    if ((e as { code?: string })?.code !== 'P2002') throw e;
  }
  return NextResponse.json({ muted: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { userId: string } }) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await prisma.tareeqMute.deleteMany({ where: { muterId: me.userId, mutedId: params.userId } });
  return NextResponse.json({ muted: false });
}
