export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';

/**
 * A banned member's one reply.
 *
 * `TareeqBan` recorded a reason and an expiry and the member could see neither, and had no
 * way to answer. A platform that bans without explaining and without letting you respond
 * reads as arbitrary even when it is entirely right — and this one is a community, where
 * that reading spreads.
 *
 * GET returns the active ban as the member is allowed to see it. POST files one appeal.
 */

const MAX_APPEAL = 1200;

export async function GET() {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ ban: null });

  const ban = await prisma.tareeqBan.findFirst({
    where: {
      userId: me.userId,
      isActive: true,
      // An expired ban is not something to explain or appeal.
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    // `bannedBy` is deliberately NOT selected: which moderator acted is internal, and
    // naming them to the banned member invites exactly the confrontation a ban ends.
    select: {
      id: true, type: true, reason: true, expiresAt: true, createdAt: true,
      appealText: true, appealedAt: true, appealStatus: true,
    },
  });

  if (!ban) return NextResponse.json({ ban: null });

  return NextResponse.json({
    ban: {
      ...ban,
      expiresAt: ban.expiresAt?.toISOString() ?? null,
      createdAt: ban.createdAt.toISOString(),
      appealedAt: ban.appealedAt?.toISOString() ?? null,
    },
  });
}

export async function POST(req: NextRequest) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = tareeqRateLimit('appeal', me.userId, 3, 24 * 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? '').trim().slice(0, MAX_APPEAL);
  if (text.length < 10) {
    return NextResponse.json({ error: 'اكتب سبباً واضحاً (10 أحرف على الأقل)' }, { status: 400 });
  }

  // `appealStatus: null` in the filter is the "one appeal" rule, enforced in the write.
  // Checking first and updating after would let two taps file two appeals.
  const res = await prisma.tareeqBan.updateMany({
    where: {
      userId: me.userId,
      isActive: true,
      appealStatus: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    data: { appealText: text, appealedAt: new Date(), appealStatus: 'pending' },
  });

  if (res.count === 0) {
    return NextResponse.json({ error: 'لا يوجد حظر نشط، أو سبق إرسال تظلّم' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
