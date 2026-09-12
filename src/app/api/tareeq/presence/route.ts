export const dynamic = 'force-dynamic';

/** How long after a heartbeat someone still counts as online. */
const ONLINE_WINDOW_MS = 3 * 60 * 1000;
/** Slightly longer than the window, so an entry never expires while it still means online. */
const PRESENCE_TTL_SECONDS = 4 * 60;
/** How often the durable column is refreshed, versus twice a minute before. */
const DB_WRITE_EVERY_SECONDS = 5 * 60;
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { getShared, setShared } from '@/lib/tareeq-store';
import { isBlockedEitherWay } from '@/lib/tareeq-guard';

// POST /api/tareeq/presence — update current user's last-seen timestamp
export async function POST() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  /**
   * Where the heartbeat goes, and why it moved.
   *
   * This wrote `User.tareeqLastSeen` every thirty seconds for everyone with a conversation
   * open — a real row update, with a row lock and a binlog entry, on the table that also
   * serves the shop's sign-in, orders and membership. Chat in Tareeq was making the shop
   * pay for it.
   *
   * "Last seen" is throwaway data with a three-minute meaning, so when there is a shared
   * store it belongs there, with an expiry. With no Redis this falls back to the column
   * exactly as before — the shop is no worse off than it is today either way.
   */
  const now = Date.now();
  await setShared(`presence:${user.userId}`, String(now), PRESENCE_TTL_SECONDS);

  // Still written to the column, but at most once every five minutes instead of twice a
  // minute. It is what a viewer sees after the store's entry expires, so dropping it
  // entirely would make everyone permanently "never seen" rather than "offline".
  const lastWriteKey = `presence-db:${user.userId}`;
  if (!(await getShared(lastWriteKey))) {
    await setShared(lastWriteKey, '1', DB_WRITE_EVERY_SECONDS);
    await prisma.user.update({
      where: { id: user.userId },
      data: { tareeqLastSeen: new Date(now) },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

// GET /api/tareeq/presence?userId=xxx — check another user's presence
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ online: false });

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get('userId');
  if (!targetId) return NextResponse.json({ online: false });

  // Presence used to be visible to literally any signed-in caller with no
  // relationship check at all — block it in either direction, same as DMs.
  if (await isBlockedEitherWay(user.userId, targetId)) {
    return NextResponse.json({ online: false, lastSeen: null });
  }

  // The store answers first — it is fresher than the column by design, since the column is
  // only refreshed every five minutes now.
  const beat = await getShared(`presence:${targetId}`);
  if (beat) {
    const at = Number(beat);
    if (Number.isFinite(at)) {
      return NextResponse.json({
        online: Date.now() - at < ONLINE_WINDOW_MS,
        lastSeen: new Date(at).toISOString(),
      });
    }
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { tareeqLastSeen: true },
  });

  const online = target?.tareeqLastSeen
    ? Date.now() - new Date(target.tareeqLastSeen).getTime() < ONLINE_WINDOW_MS
    : false;

  return NextResponse.json({ online, lastSeen: target?.tareeqLastSeen ?? null });
}
