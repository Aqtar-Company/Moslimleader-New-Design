export const dynamic = 'force-dynamic';

/**
 * Reading and setting the member's gender — the field طريق's modesty and messaging rules
 * both read from.
 *
 * GET  → { gender, setAt, profileLocked }
 * POST { gender: 'male' | 'female' } → stores it
 *
 * The value is CHANGEABLE, deliberately. A one-way choice would mean a mis-tap at the door
 * is permanent and support has to fix it by hand. Nothing is gained by locking it either:
 * declaring female does not reveal anything — it VEILS the declarer's own pictures — and
 * declaring male reveals nothing that was not already visible to men. The change is
 * timestamped so a pattern of flipping is visible if it ever matters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { isGender } from '@/lib/tareeq-gender';
import { tareeqRateLimit } from '@/lib/tareeq-guard';

export async function GET() {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ gender: null, profileLocked: false });

  const row = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { tareeqGender: true, tareeqGenderSetAt: true, tareeqProfileLocked: true },
  });

  return NextResponse.json({
    gender: row?.tareeqGender ?? null,
    setAt: row?.tareeqGenderSetAt ?? null,
    profileLocked: row?.tareeqProfileLocked ?? false,
  });
}

export async function POST(req: NextRequest) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Generous, but not unlimited: this is a two-value field and nothing needs it changed
  // ten times a minute.
  const rl = await tareeqRateLimit('gender-set', me.userId, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  if (!isGender(body.gender)) {
    return NextResponse.json({ error: 'اختر: رجل أو امرأة' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: me.userId },
    data: { tareeqGender: body.gender, tareeqGenderSetAt: new Date() },
  });

  return NextResponse.json({ ok: true, gender: body.gender });
}
