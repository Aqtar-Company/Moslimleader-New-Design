export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ membership: null });

  const membership = await prisma.familyMembership.findUnique({
    where: { ownerUserId: user.userId },
    include: { familyMembers: { orderBy: { createdAt: 'asc' } } },
  });

  // Auto-expire if past expiresAt
  if (membership && membership.status === 'ACTIVE' && membership.expiresAt && membership.expiresAt < new Date()) {
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { status: 'EXPIRED' },
    });
    return NextResponse.json({ membership: { ...membership, status: 'EXPIRED' } });
  }

  return NextResponse.json({ membership });
}
