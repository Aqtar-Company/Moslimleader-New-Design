import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import KhatmatiStats from './KhatmatiStats';
import { TOTAL_QURAN_PAGES } from '@/lib/quran-data';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const user = await getAuthUser().catch(() => null);
  if (!user) redirect('/login?next=/tareeq/khatmati/stats');

  const progress = await prisma.khatmatiProgress.findUnique({ where: { userId: user.userId } });
  if (!progress) redirect('/tareeq/khatmati');

  const pct = Math.round((progress.currentPage / TOTAL_QURAN_PAGES) * 100);
  const khatmas = Math.floor(progress.totalPagesRead / TOTAL_QURAN_PAGES);
  const daysActive = Math.max(1, Math.ceil((Date.now() - new Date(progress.createdAt).getTime()) / 86400000));
  const avgPagesPerDay = Math.max(0.1, progress.totalPagesRead / daysActive);
  const pagesLeft = TOTAL_QURAN_PAGES - progress.currentPage;
  const daysLeft = Math.ceil(pagesLeft / avgPagesPerDay);

  return (
    <KhatmatiStats
      stats={{
        currentPage: progress.currentPage,
        totalPagesRead: progress.totalPagesRead,
        sirajStreak: progress.sirajStreak,
        pct,
        khatmas,
        avgPagesPerDay: Math.round(avgPagesPerDay * 10) / 10,
        daysLeft,
        lastReadDate: progress.lastReadDate,
        startedAt: progress.createdAt.toISOString(),
      }}
    />
  );
}
