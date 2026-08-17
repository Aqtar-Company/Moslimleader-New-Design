import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import KhatmatiHome from './KhatmatiHome';

export const dynamic = 'force-dynamic';

export default async function KhatmatiPage() {
  const user = await getAuthUser().catch(() => null);
  let progress = null;
  let groups: { id: string; name: string; dailyGoal: number; memberCount: number; myStreak: number; myPoints: number; myTotalPages: number; readToday: boolean }[] = [];

  if (user) {
    const today = new Date().toLocaleDateString('en-CA');
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
      readToday: m.lastReadDate === today,
    }));
  }

  return <KhatmatiHome initialProgress={progress} initialGroups={groups} />;
}
