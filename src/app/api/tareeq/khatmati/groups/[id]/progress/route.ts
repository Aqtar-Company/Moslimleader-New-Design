export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

/** GET — return this member's reading position + group daily goal */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await prisma.khatmaGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
    select: {
      currentPage: true, currentSurah: true, currentAyah: true,
      streak: true, totalPages: true, points: true, lastReadDate: true,
      group: { select: { dailyGoal: true, name: true } },
    },
  });
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  return NextResponse.json({ member });
}

/** PUT — save reading progress for this member in the group */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const currentPage  = Math.max(1, Math.min(604, Number(body.currentPage)  || 1));
  const currentSurah = Math.max(1, Math.min(114, Number(body.currentSurah) || 1));
  const currentAyah  = Math.max(1, Number(body.currentAyah)  || 1);
  const localDate: string = body.localDate ?? new Date().toLocaleDateString('en-CA');
  // The reader sets this when the position change came from the surah picker, a bookmark
  // or a deep link rather than from turning pages.
  const jumped = body.jumped === true;

  const existing = await prisma.khatmaGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
    select: { lastReadDate: true, streak: true, totalPages: true, points: true, currentPage: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  // Compute yesterday from the client's localDate (not server clock) to handle timezone differences
  const d = new Date(localDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterdayStr = d.toISOString().slice(0, 10);

  const isNewDay = existing.lastReadDate !== localDate;
  const wasYesterday = existing.lastReadDate === yesterdayStr;

  let newStreak = existing.streak;
  if (isNewDay) {
    newStreak = (wasYesterday || existing.lastReadDate === null) ? existing.streak + 1 : 1;
  }

  // Same cap as the solo route (/api/tareeq/khatmati/progress). This route feeds `points`,
  // which orders the group leaderboard, so an uncapped surah-picker jump from page 3 to
  // page 582 credited 579 pages AND 579 points — instantly topping the board. `jumped`
  // says the move was navigation rather than reading and credits nothing; the cap stays
  // as a backstop for any path that doesn't send it.
  const MAX_PAGES_PER_SAVE = 20;
  const rawAdvance = Math.max(0, currentPage - (existing.currentPage ?? 1));
  const pagesAdvanced = jumped ? 0 : Math.min(rawAdvance, MAX_PAGES_PER_SAVE);
  // Match the streak bonus that solo readers receive (+2 per session when streak > 1)
  const pointsBonus = pagesAdvanced + (newStreak > 1 && isNewDay ? 2 : 0);

  const updated = await prisma.khatmaGroupMember.update({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
    data: {
      currentPage, currentSurah, currentAyah,
      lastReadDate: localDate,
      totalPages: { increment: pagesAdvanced },
      points: { increment: pointsBonus },
      streak: newStreak,
    },
  });

  return NextResponse.json({ ok: true, member: updated });
}

/** PATCH — toggle linkedToSolo preference for this member */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (typeof body.linkedToSolo !== 'boolean') {
    return NextResponse.json({ error: 'linkedToSolo (boolean) required' }, { status: 400 });
  }

  const existing = await prisma.khatmaGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  // When linking to solo, immediately sync current solo position
  let positionSync = {};
  if (body.linkedToSolo) {
    const solo = await prisma.khatmatiProgress.findUnique({
      where: { userId: user.userId },
      select: { currentPage: true, currentSurah: true, currentAyah: true },
    });
    if (solo) {
      positionSync = {
        currentPage: solo.currentPage,
        currentSurah: solo.currentSurah,
        currentAyah: solo.currentAyah,
      };
    }
  }

  const updated = await prisma.khatmaGroupMember.update({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
    data: { linkedToSolo: body.linkedToSolo, ...positionSync },
    select: { linkedToSolo: true, currentPage: true, currentSurah: true, currentAyah: true },
  });

  return NextResponse.json({ ok: true, member: updated });
}
