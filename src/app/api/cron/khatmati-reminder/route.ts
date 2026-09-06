export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/tareeq-push';

// Daily "light your lantern" reminder for Khatmati.
//
// This is the CONSUMER of KhatmatiProgress.dailyReminder. Without it the toggle in
// /tareeq/khatmati only persists a flag that nothing ever reads — the user opts in and
// never hears from us again.
//
// Intended schedule: once per hour. Each user is reminded at most once per calendar day,
// and only if they haven't already read that day. Because lastReadDate is written using
// the READER'S local date (see QuranReader), an hourly run naturally covers every
// timezone without us having to model offsets: a user who hasn't read "today" by their
// own clock still won't have today's date stored.
//
// Authentication: shared CRON_SECRET, header `x-cron-key: <secret>` (same convention as
// /api/cron/fb-follow-up).

const BATCH = 500;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-cron-key') === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  // Guard against double-sending when the cron fires more than once in a day: the
  // last-sent date is stamped per user in a Setting row.
  const flagKey = 'khatmati-reminder-sent';

  const candidates = await prisma.khatmatiProgress.findMany({
    where: {
      dailyReminder: true,
      // Already read today (by their own local date) — nothing to nudge about.
      NOT: { lastReadDate: today },
    },
    select: { userId: true, currentPage: true, sirajStreak: true },
    take: BATCH,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, considered: 0, sent: 0 });
  }

  const sentRow = await prisma.setting.findUnique({ where: { key: flagKey } });
  const alreadySent: Record<string, string> =
    (sentRow?.value as Record<string, string> | undefined) ?? {};

  let sent = 0;
  const nextFlags: Record<string, string> = { ...alreadySent };

  for (const c of candidates) {
    if (alreadySent[c.userId] === today) continue;
    const streakLine = c.sirajStreak > 1
      ? `سراجك مضيء منذ ${c.sirajStreak} يومًا — لا تدعه ينطفئ.`
      : 'اجعل اليوم بداية سلسلتك.';
    await sendPushToUser(c.userId, {
      type: 'generic',
      title: 'نُوري — وردك في انتظارك 🕯️',
      body: `${streakLine} تابع من صفحة ${c.currentPage}.`,
      url: '/tareeq/khatmati',
    }).catch(() => { /* no subscription / expired endpoint */ });
    nextFlags[c.userId] = today;
    sent++;
  }

  // Prune stamps older than today so this row can't grow without bound.
  for (const [uid, day] of Object.entries(nextFlags)) {
    if (day !== today) delete nextFlags[uid];
  }

  await prisma.setting.upsert({
    where: { key: flagKey },
    update: { value: nextFlags },
    create: { key: flagKey, value: nextFlags },
  });

  return NextResponse.json({ ok: true, considered: candidates.length, sent });
}
