import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const progress = await prisma.khatmatiProgress.findUnique({ where: { userId: user.userId } });
  return NextResponse.json({ progress });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currentPage, currentSurah, currentAyah } = await req.json();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const existing = await prisma.khatmatiProgress.findUnique({
    where: { userId: user.userId },
    select: { lastReadDate: true, sirajStreak: true, currentPage: true },
  });

  let sirajStreak = existing?.sirajStreak ?? 0;
  if (!existing) {
    sirajStreak = 1;
  } else if (existing.lastReadDate === today) {
    // already counted today
  } else if (existing.lastReadDate === yesterday) {
    sirajStreak += 1;
  } else {
    sirajStreak = 1;
  }

  const pagesAdvanced = (existing?.currentPage && currentPage)
    ? Math.max(0, currentPage - existing.currentPage) : 0;

  const progress = await prisma.khatmatiProgress.upsert({
    where: { userId: user.userId },
    update: {
      ...(currentPage != null && { currentPage }),
      ...(currentSurah != null && { currentSurah }),
      ...(currentAyah != null && { currentAyah }),
      lastReadDate: today,
      sirajStreak,
      totalPagesRead: { increment: pagesAdvanced },
    },
    create: {
      userId: user.userId,
      currentPage: currentPage ?? 1,
      currentSurah: currentSurah ?? 1,
      currentAyah: currentAyah ?? 1,
      lastReadDate: today,
      sirajStreak: 1,
      totalPagesRead: 0,
    },
  });

  return NextResponse.json({ progress });
}
