import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function clampInt(v: unknown, min: number, max: number): number | undefined {
  if (v == null) return undefined;
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.khatmatiWird.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== user.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const page = clampInt(body.page, 1, 604);
  const surah = clampInt(body.surah, 1, 114);
  const ayah = clampInt(body.ayah, 1, 286);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : undefined;

  const wird = await prisma.khatmatiWird.update({
    where: { id: params.id },
    data: {
      ...(page !== undefined && { page }),
      ...(surah !== undefined && { surah }),
      ...(ayah !== undefined && { ayah }),
      ...(name && { name }),
    },
  });

  return NextResponse.json({ wird });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.khatmatiWird.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== user.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.khatmatiWird.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
