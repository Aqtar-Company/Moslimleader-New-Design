import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET — check for an incoming ringing call that already has an offer
export async function GET(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ call: null });

  // Only surface calls that have an offer set (caller's screen has initialised the PC)
  const call = await prisma.tareeqCall.findFirst({
    where: {
      calleeId: user.userId,
      status: 'ringing',
      offer: { not: null },
      createdAt: { gt: new Date(Date.now() - 45_000) },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      caller: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ call });
}
