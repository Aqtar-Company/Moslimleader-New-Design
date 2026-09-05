import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import KhatmaGroupDetail from './KhatmaGroupDetail';

export const dynamic = 'force-dynamic';

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) redirect(`/tareeq/login?redirect=/tareeq/khatmati/groups/${params.id}`);

  const [group, soloProgress] = await Promise.all([
    prisma.khatmaGroup.findUnique({
      where: { id: params.id },
      include: {
        admin: { select: { id: true, name: true, avatarUrl: true } },
        members: {
          select: {
            id: true, streak: true, lastReadDate: true, totalPages: true, points: true, joinedAt: true,
            currentPage: true, currentSurah: true, currentAyah: true, linkedToSolo: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { points: 'desc' },
        },
      },
    }),
    prisma.khatmatiProgress.findUnique({
      where: { userId: user.userId },
      select: { currentPage: true, currentSurah: true, currentAyah: true },
    }),
  ]);

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
  const linkedToSolo = myMember?.linkedToSolo ?? false;

  // If linked to solo, use the solo reading position for the CTA
  const ctaPage  = linkedToSolo ? (soloProgress?.currentPage  ?? myMember?.currentPage  ?? 1) : (myMember?.currentPage  ?? 1);
  const ctaSurah = linkedToSolo ? (soloProgress?.currentSurah ?? myMember?.currentSurah ?? 1) : (myMember?.currentSurah ?? 1);
  const ctaAyah  = linkedToSolo ? (soloProgress?.currentAyah  ?? myMember?.currentAyah  ?? 1) : (myMember?.currentAyah  ?? 1);

  return (
    <KhatmaGroupDetail
      group={{ id: group.id, name: group.name, description: group.description, dailyGoal: group.dailyGoal, inviteCode: group.adminId === user.userId ? group.inviteCode : null, isAdmin: group.adminId === user.userId }}
      members={membersWithStatus}
      userId={user.userId}
      myCurrentPage={ctaPage}
      myCurrentSurah={ctaSurah}
      myCurrentAyah={ctaAyah}
      linkedToSolo={linkedToSolo}
    />
  );
}
