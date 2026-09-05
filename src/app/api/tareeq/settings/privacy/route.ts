export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

const VALID_PRIVACY = ['everyone', 'followers', 'nobody'];

// PATCH /api/tareeq/settings/privacy
// body: { tareeqMessagePrivacy: 'everyone' | 'followers' | 'nobody' }
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const privacy = String(body.tareeqMessagePrivacy ?? '').trim();

  if (!VALID_PRIVACY.includes(privacy)) {
    return NextResponse.json({ error: 'قيمة غير صالحة' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { tareeqMessagePrivacy: privacy } as object,
  });

  return NextResponse.json({ ok: true, tareeqMessagePrivacy: privacy });
}
