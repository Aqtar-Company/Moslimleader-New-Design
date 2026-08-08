export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// POST /api/tareeq/presence — update current user's last-seen timestamp
export async function POST() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  await prisma.user.update({
    where: { id: user.userId },
    data: { tareeqLastSeen: new Date() },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

// GET /api/tareeq/presence?userId=xxx — check another user's presence
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ online: false });

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get('userId');
  if (!targetId) return NextResponse.json({ online: false });

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { tareeqLastSeen: true },
  });

  const online = target?.tareeqLastSeen
    ? Date.now() - new Date(target.tareeqLastSeen).getTime() < 3 * 60 * 1000
    : false;

  return NextResponse.json({ online, lastSeen: target?.tareeqLastSeen ?? null });
}
