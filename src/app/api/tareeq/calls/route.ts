import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST — initiate a call (offer is NOT sent here; the call screen POSTs it via PATCH setOffer)
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { calleeId, type = 'audio' } = await req.json();
  if (!calleeId) return NextResponse.json({ error: 'calleeId required' }, { status: 400 });
  if (calleeId === user.userId) return NextResponse.json({ error: 'Cannot call yourself' }, { status: 400 });

  const callee = await prisma.user.findUnique({ where: { id: calleeId }, select: { id: true } });
  if (!callee) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // End any stale ringing calls from this caller (> 60s old)
  await prisma.tareeqCall.updateMany({
    where: { callerId: user.userId, status: 'ringing', createdAt: { lt: new Date(Date.now() - 60_000) } },
    data: { status: 'missed' },
  });

  const call = await prisma.tareeqCall.create({
    data: { callerId: user.userId, calleeId, type, callerIce: [] },
  });

  return NextResponse.json({ callId: call.id });
}
