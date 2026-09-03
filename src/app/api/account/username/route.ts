export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';

// PATCH /api/account/username — set or clear the user's tareeq username
export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 10 attempts per hour per user to prevent username enumeration
  const rl = tareeqRateLimit('username', auth.userId, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const raw = String(body.username ?? '').trim();

  // Clear username
  if (!raw) {
    await prisma.user.update({ where: { id: auth.userId }, data: { username: null } });
    return NextResponse.json({ ok: true, username: null });
  }

  // Validate: 3-30 chars, alphanumeric + underscore
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(raw)) {
    return NextResponse.json({ error: 'اسم المستخدم يجب أن يكون 3-30 حرف (أرقام وحروف إنجليزية وشرطة سفلية فقط)' }, { status: 400 });
  }

  // Block cuid-shaped names (c + 20-30 lowercase alphanumeric chars) to avoid
  // ambiguity with user IDs in the profile URL resolver.
  if (/^c[a-z0-9]{20,29}$/.test(raw.toLowerCase())) {
    return NextResponse.json({ error: 'هذا الاسم غير مسموح به، جرب اسماً آخر' }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: { username: raw.toLowerCase() },
      select: { username: true },
    });
    return NextResponse.json({ ok: true, username: updated.username });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'هذا الاسم محجوز، جرب اسماً آخر' }, { status: 409 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
