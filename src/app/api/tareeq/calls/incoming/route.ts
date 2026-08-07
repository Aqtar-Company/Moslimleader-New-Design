import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET — check for an incoming ringing call
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ call: null });

  // Find the most recent ringing call to this user that is ≤ 45s old
  const call = await prisma.tareeqCall.findFirst({
    where: {
      calleeId: user.id,
      status: 'ringing',
      createdAt: { gt: new Date(Date.now() - 45_000) },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      caller: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ call });
}
