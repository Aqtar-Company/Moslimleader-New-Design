import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function parseIntField(v: unknown, min: number, max: number): number | null | undefined {
  if (v == null) return undefined;
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const progress = await prisma.khatmatiProgress.findUnique({ where: { userId: user.userId } });
  return NextResponse.json({ progress });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Explicit "start a new khatma" reset — forces position back to page 1 and zeroes the
  // page count. A plain currentPage:1 update wouldn't do this: totalPagesRead only ever
  // moves via pagesAdvanced below (max(0, currentPage - existing.currentPage)), which is
  // 0 when currentPage goes DOWN, so it can advance but never reset without this flag.
  const isReset = body.reset === true;

  const currentPage      = parseIntField(isReset ? 1 : body.currentPage,      1, 604);
  const currentSurah     = parseIntField(isReset ? 1 : body.currentSurah,     1, 114);
  const currentAyah      = parseIntField(isReset ? 1 : body.currentAyah,      1, 286);
  const dailyGoalPages   = parseIntField(body.dailyGoalPages,   1, 20);

  if (currentPage === null || currentSurah === null || currentAyah === null) {
    return NextResponse.json({ error: 'Invalid field value' }, { status: 400 });
  }

  const rawLocalDate = body.localDate;
  const today = typeof rawLocalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawLocalDate)
    ? rawLocalDate
    : new Date().toISOString().slice(0, 10);

  const d = new Date(today + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);

  const existing = await prisma.khatmatiProgress.findUnique({
    where: { userId: user.userId },
    select: { lastReadDate: true, sirajStreak: true, currentPage: true },
  });

  let sirajStreak = existing?.sirajStreak ?? 0;
  if (!existing) {
    sirajStreak = 1;
  } else if (existing.lastReadDate === today) {
    // already counted today — leave streak unchanged
  } else if (existing.lastReadDate === yesterday) {
    sirajStreak += 1;
  } else {
    sirajStreak = 1;
  }

  // Cap what a single save can credit. A forward JUMP (surah picker, search, deep link)
  // is navigation, not reading — uncapped it credited hundreds of pages at once and
  // inflated totalPagesRead, the "full khatmas" figure and the daily averages.
  const MAX_PAGES_PER_SAVE = 20;
  const rawAdvance = (existing?.currentPage != null && currentPage != null)
    ? Math.max(0, currentPage - existing.currentPage) : 0;
  // `jumped` says the reader navigated rather than read; the cap remains a backstop for
  // any client that doesn't send it.
  const jumped = body.jumped === true;
  const pagesAdvanced = (isReset || jumped) ? 0 : Math.min(rawAdvance, MAX_PAGES_PER_SAVE);

  const progress = await prisma.khatmatiProgress.upsert({
    where: { userId: user.userId },
    update: {
      ...(currentPage      != null && { currentPage }),
      ...(currentSurah     != null && { currentSurah }),
      ...(currentAyah      != null && { currentAyah }),
      ...(dailyGoalPages   != null && { dailyGoalPages }),
      // A reset reads zero pages, so it must NOT count as a reading day: writing
      // lastReadDate=today lit the "read today" lamp and could mint a streak day for a
      // button press (and keep an otherwise-broken streak alive).
      ...(isReset
        ? { totalPagesRead: 0 }
        : { lastReadDate: today, sirajStreak, totalPagesRead: { increment: pagesAdvanced } }),
    },
    create: {
      userId:        user.userId,
      currentPage:   currentPage   ?? 1,
      currentSurah:  currentSurah  ?? 1,
      currentAyah:   currentAyah   ?? 1,
      dailyGoalPages: dailyGoalPages ?? 4,
      lastReadDate:  today,
      sirajStreak:   1,
      totalPagesRead: 0,
    },
  });

  // Update ONLY linkedToSolo group memberships with today's read date + streak + page
  // advance, and mirror the reading position. Groups explicitly promise independent
  // members "a separate position and counter — group reading is independent from your
  // solo khatma" (see KhatmaGroupDetail.tsx); without this `linkedToSolo` filter, solo
  // reading silently bumped every group's leaderboard/streak/points regardless, since
  // only the position mirror below was actually gated on it.
  if (pagesAdvanced > 0) {
    const memberships = await prisma.khatmaGroupMember.findMany({
      where: { userId: user.userId, linkedToSolo: true },
      select: { id: true, lastReadDate: true, streak: true, linkedToSolo: true },
    });
    for (const m of memberships) {
      let mStreak = m.streak;
      if (m.lastReadDate === today) {
        // already counted
      } else if (m.lastReadDate === yesterday) {
        mStreak += 1;
      } else {
        mStreak = 1;
      }
      await prisma.khatmaGroupMember.update({
        where: { id: m.id },
        data: {
          totalPages: { increment: pagesAdvanced },
          lastReadDate: today,
          streak: mStreak,
          // Award the streak bonus once per day, matching the group route — granting it
          // on every save let linked members out-earn independent ones for the same reading.
          points: { increment: pagesAdvanced + (mStreak > 1 && m.lastReadDate !== today ? 2 : 0) },
          // Mirror reading position (m.linkedToSolo is always true here now, but kept as
          // an explicit guard rather than relying solely on the query filter above)
          ...(m.linkedToSolo && currentPage != null && {
            currentPage,
            ...(currentSurah != null && { currentSurah }),
            ...(currentAyah  != null && { currentAyah }),
          }),
        },
      });
    }
  }

  return NextResponse.json({ progress });
}
