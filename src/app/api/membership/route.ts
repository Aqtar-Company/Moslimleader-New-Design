export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

async function getDiscountRates(): Promise<{ leaderDiscountPct: number; communityDiscountPct: number }> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['membership-discount-leader', 'membership-discount-community'] } },
  }).catch(() => []);
  const map = Object.fromEntries(settings.map(s => [s.key, s.value as string]));
  return {
    leaderDiscountPct:    parseInt(map['membership-discount-leader']    ?? '', 10) || 15,
    communityDiscountPct: parseInt(map['membership-discount-community'] ?? '', 10) || 5,
  };
}

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) {
    const rates = await getDiscountRates();
    return NextResponse.json({ membership: null, communityMemberNumber: null, ...rates });
  }

  const [dbUser, membership, rates] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.userId }, select: { communityMemberNumber: true } }),
    prisma.familyMembership.findUnique({
      where: { ownerUserId: user.userId },
      include: { familyMembers: { orderBy: { createdAt: 'asc' } } },
    }),
    getDiscountRates(),
  ]);

  // Auto-expire if past expiresAt
  if (membership && membership.status === 'ACTIVE' && membership.expiresAt && membership.expiresAt < new Date()) {
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { status: 'EXPIRED' },
    });
    return NextResponse.json({ membership: { ...membership, status: 'EXPIRED' }, communityMemberNumber: dbUser?.communityMemberNumber ?? null, ...rates });
  }

  return NextResponse.json({ membership, communityMemberNumber: dbUser?.communityMemberNumber ?? null, ...rates });
}
