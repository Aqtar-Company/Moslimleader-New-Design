import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import KhatmaGroupsClient from './KhatmaGroupsClient';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const user = await getAuthUser().catch(() => null);
  if (!user) redirect('/tareeq/login?redirect=/tareeq/khatmati/groups');

  const memberships = await prisma.khatmaGroupMember.findMany({
    where: { userId: user.userId },
    include: {
      group: {
        include: {
          admin: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const groups = memberships.map(m => ({
    id: m.group.id,
    name: m.group.name,
    description: m.group.description,
    dailyGoal: m.group.dailyGoal,
    inviteCode: m.group.adminId === user.userId ? m.group.inviteCode : null,
    isAdmin: m.group.adminId === user.userId,
    memberCount: m.group._count.members,
    adminName: m.group.admin.name,
    myStreak: m.streak,
    myPoints: m.points,
    myTotalPages: m.totalPages,
  }));

  return <KhatmaGroupsClient userId={user.userId} initialGroups={groups} />;
}
