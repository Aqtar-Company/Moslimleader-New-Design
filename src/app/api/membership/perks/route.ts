export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// Public: returns active perks for everyone (marketing info).
// Authenticated active members also get their membership status.
export async function GET() {
  const user = await getAuthUser().catch(() => null);

  let isMember = false;
  if (user) {
    const membership = await prisma.familyMembership.findUnique({
      where: { ownerUserId: user.userId },
      select: { status: true, expiresAt: true },
    });
    isMember = membership?.status === 'ACTIVE' && !!membership.expiresAt && membership.expiresAt > new Date();
  }

  const perks = await prisma.membershipPerk.findMany({
    where: {
      isActive: true,
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      // Community members (isMember=false) only see 'all' tier perks
      ...(isMember ? {} : { forTier: 'all' }),
    },
    select: {
      id: true, title: true, description: true,
      imageUrl: true, linkUrl: true, validUntil: true, createdAt: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ perks, isMember });
}
