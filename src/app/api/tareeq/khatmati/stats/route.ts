export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { TOTAL_QURAN_PAGES } from '@/lib/quran-data';

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const progress = await prisma.khatmatiProgress.findUnique({ where: { userId: user.userId } });
  if (!progress) return NextResponse.json({ stats: null });

  const pct = Math.round((progress.currentPage / TOTAL_QURAN_PAGES) * 100);
  const khatmas = Math.floor(progress.totalPagesRead / TOTAL_QURAN_PAGES);

  // Estimate finish date based on average pace (pages per day over last week)
  const daysActive = Math.max(1, Math.ceil((Date.now() - new Date(progress.createdAt).getTime()) / 86400000));
  const avgPagesPerDay = Math.max(0.1, progress.totalPagesRead / daysActive);
  const pagesLeft = TOTAL_QURAN_PAGES - progress.currentPage;
  const daysLeft = Math.ceil(pagesLeft / avgPagesPerDay);
  const estimatedFinish = new Date(Date.now() + daysLeft * 86400000).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

  return NextResponse.json({
    stats: {
      currentPage: progress.currentPage,
      totalPagesRead: progress.totalPagesRead,
      sirajStreak: progress.sirajStreak,
      pct,
      khatmas,
      avgPagesPerDay: Math.round(avgPagesPerDay * 10) / 10,
      daysLeft,
      estimatedFinish,
      startedAt: progress.createdAt,
      lastReadDate: progress.lastReadDate,
    },
  });
}
