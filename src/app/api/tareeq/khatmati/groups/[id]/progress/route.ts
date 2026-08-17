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

  const existing = await prisma.khatmaGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
    select: { lastReadDate: true, streak: true, totalPages: true, points: true, currentPage: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');

  const isNewDay = existing.lastReadDate !== localDate;
  const wasYesterday = existing.lastReadDate === yesterdayStr;

  const pagesAdvanced = Math.max(0, currentPage - (existing.currentPage ?? 1));

  const updated = await prisma.khatmaGroupMember.update({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
    data: {
      currentPage, currentSurah, currentAyah,
      lastReadDate: localDate,
      totalPages: { increment: pagesAdvanced },
      points: { increment: pagesAdvanced },
      streak: isNewDay ? (wasYesterday || existing.lastReadDate === null ? { increment: 1 } : 1) : existing.streak,
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
