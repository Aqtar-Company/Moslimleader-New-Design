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

  const currentPage      = parseIntField(body.currentPage,      1, 604);
  const currentSurah     = parseIntField(body.currentSurah,     1, 114);
  const currentAyah      = parseIntField(body.currentAyah,      1, 286);
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

  const pagesAdvanced = (existing?.currentPage != null && currentPage != null)
    ? Math.max(0, currentPage - existing.currentPage) : 0;

  const progress = await prisma.khatmatiProgress.upsert({
    where: { userId: user.userId },
    update: {
      ...(currentPage      != null && { currentPage }),
      ...(currentSurah     != null && { currentSurah }),
      ...(currentAyah      != null && { currentAyah }),
      ...(dailyGoalPages   != null && { dailyGoalPages }),
      lastReadDate: today,
      sirajStreak,
      totalPagesRead: { increment: pagesAdvanced },
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

  // Update all group memberships with today's read date + streak + page advance
  // For linkedToSolo groups: also sync the reading position (currentPage/Surah/Ayah)
  if (pagesAdvanced > 0) {
    const memberships = await prisma.khatmaGroupMember.findMany({
      where: { userId: user.userId },
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
          points: { increment: pagesAdvanced + (mStreak > 1 ? 2 : 0) },
          // Mirror reading position for linked groups
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
