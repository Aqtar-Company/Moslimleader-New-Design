export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.familyMembership.findUnique({
    where: { ownerUserId: user.userId },
    select: { status: true, expiresAt: true },
  });

  const isActive = membership?.status === 'ACTIVE' && membership.expiresAt && membership.expiresAt > new Date();
  if (!isActive) return NextResponse.json({ error: 'Active membership required' }, { status: 403 });

  const perks = await prisma.membershipPerk.findMany({
    where: {
      isActive: true,
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ perks });
}
