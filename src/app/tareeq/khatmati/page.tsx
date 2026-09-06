import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import KhatmatiHome from './KhatmatiHome';

export const dynamic = 'force-dynamic';

export default async function KhatmatiPage() {
  const user = await getAuthUser().catch(() => null);
  let progress = null;
  // lastReadDate is exposed raw — KhatmatiHome (client) compares it against "today"
  // using the browser's own local date, since this server component's "today" would be
  // the container's (UTC) timezone and can disagree with the reader's near midnight.
  let groups: { id: string; name: string; dailyGoal: number; memberCount: number; myStreak: number; myPoints: number; myTotalPages: number; lastReadDate: string | null; myCurrentPage: number; myCurrentSurah: number; myCurrentAyah: number; }[] = [];

  if (user) {
    [progress] = await Promise.all([
      prisma.khatmatiProgress.findUnique({ where: { userId: user.userId } }),
    ]);
    const memberships = await prisma.khatmaGroupMember.findMany({
      where: { userId: user.userId },
      include: {
        group: {
          select: { id: true, name: true, dailyGoal: true, _count: { select: { members: true } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    groups = memberships.map(m => ({
      id: m.group.id,
      name: m.group.name,
      dailyGoal: m.group.dailyGoal,
      memberCount: m.group._count.members,
      myStreak: m.streak,
      myPoints: m.points,
      myTotalPages: m.totalPages,
      lastReadDate: m.lastReadDate,
      myCurrentPage: m.currentPage,
      myCurrentSurah: m.currentSurah,
      myCurrentAyah: m.currentAyah,
    }));
  }

  return <KhatmatiHome initialProgress={progress} initialGroups={groups} />;
}
