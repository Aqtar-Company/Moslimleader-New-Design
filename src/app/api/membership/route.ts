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
    leaderDiscountPct:    (() => { const v = parseInt(map['membership-discount-leader']    ?? '', 10); return Number.isNaN(v) ? 15 : v; })(),
    communityDiscountPct: (() => { const v = parseInt(map['membership-discount-community'] ?? '', 10); return Number.isNaN(v) ? 5  : v; })(),
  };
}

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) {
    const rates = await getDiscountRates();
    return NextResponse.json({ membership: null, communityMemberNumber: null, ...rates });
  }

  const [dbUser, membership, rates] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.userId }, select: { communityMemberNumber: true, createdAt: true } }),
    prisma.familyMembership.findUnique({
      where: { ownerUserId: user.userId },
      include: { familyMembers: { orderBy: { createdAt: 'asc' } } },
      // tier field is included via default select (all scalar fields)
    }),
    getDiscountRates(),
  ]);

  // Auto-assign communityMemberNumber if missing — every registered user gets one
  let communityMemberNumber = dbUser?.communityMemberNumber ?? null;
  if (!communityMemberNumber) {
    // Generate a unique stable number: CM-YY-NNNNN based on userId hash
    const seed = parseInt(user.userId.replace(/\D/g, '').slice(0, 8) || '1', 10);
    const year = (dbUser?.createdAt ?? new Date()).getFullYear().toString().slice(-2);
    const num = String(seed % 99999 + 1).padStart(5, '0');
    const candidate = `CM-${year}-${num}`;
    try {
      const updated = await prisma.user.update({
        where: { id: user.userId },
        data: { communityMemberNumber: candidate },
        select: { communityMemberNumber: true },
      });
      communityMemberNumber = updated.communityMemberNumber;
    } catch {
      // Collision (rare) — use userId-based fallback without saving
      communityMemberNumber = candidate;
    }
  }

  // Auto-expire if past expiresAt (community tier never expires)
  if (membership && membership.status === 'ACTIVE' && membership.tier !== 'community' && membership.expiresAt && membership.expiresAt < new Date()) {
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { status: 'EXPIRED' },
    });
    return NextResponse.json({ membership: { ...membership, status: 'EXPIRED' }, communityMemberNumber, ...rates });
  }

  return NextResponse.json({ membership, communityMemberNumber, ...rates });
}
