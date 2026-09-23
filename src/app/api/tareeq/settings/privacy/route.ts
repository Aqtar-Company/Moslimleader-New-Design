export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

const VALID_PRIVACY = ['everyone', 'followers', 'nobody'];

// PATCH /api/tareeq/settings/privacy
// body: { tareeqMessagePrivacy?: 'everyone' | 'followers' | 'nobody', tareeqProfileLocked?: boolean }
//
// Both fields are optional and are applied independently, so a client that only knows
// about one does not silently reset the other.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { tareeqMessagePrivacy?: string; tareeqProfileLocked?: boolean } = {};

  if (body.tareeqMessagePrivacy !== undefined) {
    const privacy = String(body.tareeqMessagePrivacy ?? '').trim();
    if (!VALID_PRIVACY.includes(privacy)) {
      return NextResponse.json({ error: 'قيمة غير صالحة' }, { status: 400 });
    }
    data.tareeqMessagePrivacy = privacy;
  }

  if (body.tareeqProfileLocked !== undefined) {
    if (typeof body.tareeqProfileLocked !== 'boolean') {
      return NextResponse.json({ error: 'قيمة غير صالحة' }, { status: 400 });
    }
    data.tareeqProfileLocked = body.tareeqProfileLocked;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'لا جديد' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.user.update as any)({ where: { id: user.userId }, data });

  const after = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { tareeqMessagePrivacy: true, tareeqProfileLocked: true },
  });
  return NextResponse.json({ ok: true, ...after });
}
