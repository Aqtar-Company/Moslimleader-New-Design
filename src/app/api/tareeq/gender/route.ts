export const dynamic = 'force-dynamic';

/**
 * The profile step: country, year of birth, and whether the member is a man or a woman.
 *
 * GET  → { gender, country, birthYear, setAt, profileLocked }
 * POST { gender, country?, birthYear? } → stores them
 *
 * The gender is the only required one, because the platform's modesty defaults cannot place
 * a member on either side of them without it. Nothing about those defaults is explained to
 * the member here or anywhere in the UI: they are how طريق conducts itself, a floor for the
 * case where someone does not keep it themselves, and not a guarantee anyone is offered.
 * The distinction matters — the blur is a CSS filter, and a promise about it would be a
 * promise we cannot keep.
 *
 * The value is changeable, but NOT freely — and the reasoning here was wrong once, so it
 * is written out.
 *
 * The earlier note said "declaring female does not reveal anything — it VEILS the
 * declarer's own pictures". That is true of the declarer's own pictures and false of
 * everything else: the veil is computed from the VIEWER's gender, so a man who declares
 * female unveils every woman on the platform to himself and stops being asked the kinship
 * question. One tap, in the ordinary settings UI. The cost to him was that other men
 * stopped seeing his own photo.
 *
 * Locking it permanently is not the answer either — a mis-tap at the door would then need
 * support to undo. So: free to SET while it is unset, and afterwards changeable once every
 * 30 days, which leaves a genuine correction easy and makes flipping it as a way to look
 * around useless. Each change is timestamped, so the pattern is visible.
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
    select: {
      tareeqGender: true, tareeqGenderSetAt: true, tareeqProfileLocked: true,
      country: true, birthYear: true,
    },
  });

  return NextResponse.json({
    gender: row?.tareeqGender ?? null,
    country: row?.country ?? null,
    birthYear: row?.birthYear ?? null,
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

  const current = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { tareeqGender: true, tareeqGenderSetAt: true },
  });

  // Re-sending the same value is not a change — it costs nothing and must not start a
  // cooldown, or a double tap would lock someone out of a correction for a month.
  if (current?.tareeqGender && current.tareeqGender !== body.gender) {
    const setAt = current.tareeqGenderSetAt?.getTime() ?? 0;
    const days = (Date.now() - setAt) / 86_400_000;
    if (days < 30) {
      return NextResponse.json(
        { error: `يمكن تغيير هذا بعد ${Math.ceil(30 - days)} يوماً. راسل الدعم إن كان خطأً.` },
        { status: 429 },
      );
    }
  }

  // Both optional, and both accepted only in a shape that is obviously valid — this is a
  // profile form, not a place to store arbitrary strings.
  const country = typeof body.country === 'string' && /^[A-Za-z]{2}$/.test(body.country.trim())
    ? body.country.trim().toUpperCase()
    : undefined;
  const year = Number(body.birthYear);
  const thisYear = new Date().getFullYear();
  const birthYear = Number.isInteger(year) && year >= thisYear - 100 && year <= thisYear - 7
    ? year
    : undefined;

  await prisma.user.update({
    where: { id: me.userId },
    data: {
      tareeqGender: body.gender,
      tareeqGenderSetAt: new Date(),
      ...(country !== undefined ? { country } : {}),
      ...(birthYear !== undefined ? { birthYear } : {}),
    },
  });

  return NextResponse.json({ ok: true, gender: body.gender, country: country ?? null, birthYear: birthYear ?? null });
}
