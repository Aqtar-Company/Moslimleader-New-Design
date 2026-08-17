import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import KhatmaGroupDetail from './KhatmaGroupDetail';

export const dynamic = 'force-dynamic';

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) redirect(`/login?next=/tareeq/khatmati/groups/${params.id}`);

  const group = await prisma.khatmaGroup.findUnique({
    where: { id: params.id },
    include: {
      admin: { select: { id: true, name: true, avatarUrl: true } },
      members: {
        select: {
          id: true, streak: true, lastReadDate: true, totalPages: true, points: true, joinedAt: true,
          currentPage: true, currentSurah: true, currentAyah: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { points: 'desc' },
      },
    },
  });

  if (!group) notFound();

  const isMember = group.members.some(m => m.user.id === user.userId);
  if (!isMember) redirect('/tareeq/khatmati/groups');

  const today = new Date().toLocaleDateString('en-CA');
  const membersWithStatus = group.members.map((m, rank) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl,
    streak: m.streak,
    totalPages: m.totalPages,
    points: m.points,
    readToday: m.lastReadDate === today,
    rank: rank + 1,
    currentPage: m.currentPage,
    currentSurah: m.currentSurah,
    currentAyah: m.currentAyah,
  }));

  const myMember = group.members.find(m => m.user.id === user.userId);

  return (
    <KhatmaGroupDetail
      group={{ id: group.id, name: group.name, description: group.description, dailyGoal: group.dailyGoal, inviteCode: group.adminId === user.userId ? group.inviteCode : null, isAdmin: group.adminId === user.userId }}
      members={membersWithStatus}
      userId={user.userId}
      myCurrentPage={myMember?.currentPage ?? 1}
      myCurrentSurah={myMember?.currentSurah ?? 1}
      myCurrentAyah={myMember?.currentAyah ?? 1}
    />
  );
}
