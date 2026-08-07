import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST — initiate a call
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { calleeId, type = 'audio', offer } = await req.json();
  if (!calleeId || !offer) return NextResponse.json({ error: 'calleeId and offer required' }, { status: 400 });
  if (calleeId === user.id) return NextResponse.json({ error: 'Cannot call yourself' }, { status: 400 });

  const callee = await prisma.user.findUnique({ where: { id: calleeId }, select: { id: true } });
  if (!callee) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // End any stale ringing calls from this caller (> 60s old)
  await prisma.tareeqCall.updateMany({
    where: { callerId: user.id, status: 'ringing', createdAt: { lt: new Date(Date.now() - 60_000) } },
    data: { status: 'missed' },
  });

  const call = await prisma.tareeqCall.create({
    data: { callerId: user.id, calleeId, type, offer, callerIce: [] },
  });

  return NextResponse.json({ callId: call.id });
}
