export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public — no auth needed. callId is an unguessable UUID so exposure is minimal.
// Service workers use this to decide whether to keep ringing.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const call = await prisma.tareeqCall.findUnique({
    where: { id: params.id },
    select: { status: true, createdAt: true },
  });
  if (!call) return NextResponse.json({ ringing: false });
  const age = Date.now() - new Date(call.createdAt).getTime();
  const ringing = call.status === 'ringing' && age < 90_000;
  return NextResponse.json({ ringing });
}
