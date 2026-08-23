import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import MembershipDashboard from './MembershipDashboard';
import MembershipLanding from './MembershipLanding';

export const dynamic = 'force-dynamic';

export default async function MembershipPage() {
  const user = await getAuthUser().catch(() => null);

  let membership = null;
  let perks: { id: string; title: string; description: string | null; imageUrl: string | null; linkUrl: string | null; validUntil: Date | null }[] = [];
  let ownerName = '';

  if (user) {
    membership = await prisma.familyMembership.findUnique({
      where: { ownerUserId: user.userId },
      include: { familyMembers: { orderBy: { createdAt: 'asc' } } },
    });

    // Auto-expire
    if (membership && membership.status === 'ACTIVE' && membership.expiresAt && membership.expiresAt < new Date()) {
      membership = await prisma.familyMembership.update({
        where: { id: membership.id },
        data: { status: 'EXPIRED' },
        include: { familyMembers: { orderBy: { createdAt: 'asc' } } },
      });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });
    ownerName = dbUser?.name ?? '';

    // Load perks for active members
    if (membership?.status === 'ACTIVE') {
      perks = await prisma.membershipPerk.findMany({
        where: {
          isActive: true,
          OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        select: { id: true, title: true, description: true, imageUrl: true, linkUrl: true, validUntil: true },
      });
    }
  }

  if (membership && (membership.status === 'ACTIVE' || membership.status === 'EXPIRED' || membership.status === 'PENDING' || membership.status === 'CANCELLED')) {
    return (
      <MembershipDashboard
        membership={{
          id: membership.id,
          membershipNumber: membership.membershipNumber,
          qrToken: membership.qrToken,
          familyName: membership.familyName,
          memberSince: membership.memberSince,
          status: membership.status,
          startsAt: membership.startsAt?.toISOString() ?? null,
          expiresAt: membership.expiresAt?.toISOString() ?? null,
          familyMembers: membership.familyMembers.map(m => ({
            id: m.id, name: m.name, relation: m.relation, birthdate: m.birthdate,
          })),
        }}
        ownerName={ownerName}
        perks={perks.map(p => ({ ...p, validUntil: p.validUntil?.toISOString() ?? null }))}
        isLoggedIn={!!user}
      />
    );
  }

  return <MembershipLanding isLoggedIn={!!user} />;
}
