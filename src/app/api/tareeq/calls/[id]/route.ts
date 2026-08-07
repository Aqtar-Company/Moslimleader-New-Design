import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET — poll call signaling state
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const call = await prisma.tareeqCall.findUnique({
    where: { id: params.id },
    include: {
      caller: { select: { id: true, name: true, avatarUrl: true } },
      callee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (call.callerId !== user.id && call.calleeId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ call });
}

// PATCH — update call state (signaling actions)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const call = await prisma.tareeqCall.findUnique({ where: { id: params.id } });
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (call.callerId !== user.id && call.calleeId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === 'answer' && call.calleeId === user.id) {
    const updated = await prisma.tareeqCall.update({
      where: { id: params.id },
      data: { status: 'active', answer: body.answer, calleeIce: [], startedAt: new Date() },
    });
    return NextResponse.json({ call: updated });
  }

  if (action === 'reject' && call.calleeId === user.id) {
    const updated = await prisma.tareeqCall.update({
      where: { id: params.id },
      data: { status: 'rejected', endedAt: new Date() },
    });
    return NextResponse.json({ call: updated });
  }

  if (action === 'end') {
    const updated = await prisma.tareeqCall.update({
      where: { id: params.id },
      data: { status: 'ended', endedAt: new Date() },
    });
    return NextResponse.json({ call: updated });
  }

  if (action === 'callerIce' && call.callerId === user.id && body.candidate) {
    const existing = (call.callerIce as unknown[]) ?? [];
    const updated = await prisma.tareeqCall.update({
      where: { id: params.id },
      data: { callerIce: [...existing, body.candidate] },
    });
    return NextResponse.json({ call: updated });
  }

  if (action === 'calleeIce' && call.calleeId === user.id && body.candidate) {
    const existing = (call.calleeIce as unknown[]) ?? [];
    const updated = await prisma.tareeqCall.update({
      where: { id: params.id },
      data: { calleeIce: [...existing, body.candidate] },
    });
    return NextResponse.json({ call: updated });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
