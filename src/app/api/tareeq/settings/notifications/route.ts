export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';
import { NOTIF_GROUPS } from '@/lib/tareeq-notify';

const VALID = new Set(NOTIF_GROUPS.map(g => g.key));

/** The nine switches, and which of them this user has turned off. */
export async function GET() {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ groups: NOTIF_GROUPS, prefs: {} });

  const u = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { tareeqNotifPrefs: true },
  });

  // Absent prefs mean every type is on — the behaviour before this existed.
  const raw = u?.tareeqNotifPrefs;
  const prefs = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return NextResponse.json({ groups: NOTIF_GROUPS, prefs });
}

/**
 * Sets one switch. PATCH, not PUT: sending the whole object back would let a stale tab
 * silently re-enable a group the user turned off in another one.
 */
export async function PATCH(req: NextRequest) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = tareeqRateLimit('notif-prefs', me.userId, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === 'string' ? body.key : null;
  const enabled = body.enabled;

  // Whitelist, not spread: `tareeqNotifPrefs` is a Json column, so an unchecked merge
  // would let a caller store arbitrary keys and any amount of data in it.
  if (!key || !VALID.has(key) || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'invalid key or value' }, { status: 400 });
  }

  const u = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { tareeqNotifPrefs: true },
  });
  const raw = u?.tareeqNotifPrefs;
  const current: Record<string, boolean> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, boolean>) } : {};

  // Store only the switches that are OFF. Keeping `true` entries would freeze a user's
  // preferences against any group added later — a new group would arrive already off for
  // everyone who had ever opened this screen.
  if (enabled) delete current[key];
  else current[key] = false;

  await prisma.user.update({
    where: { id: me.userId },
    // Prisma.DbNull, not `undefined`: `undefined` means "leave this column alone", so
    // switching the last group back on would have kept the old value stored forever.
    data: {
      tareeqNotifPrefs: Object.keys(current).length ? current : Prisma.DbNull,
    },
  });

  return NextResponse.json({ ok: true, prefs: current });
}
