export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const endpoint = body.endpoint;
  if (!endpoint) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });

  await prisma.tareeqPushSubscription.deleteMany({
    where: { userId: user.userId, endpoint },
  });

  return NextResponse.json({ ok: true });
}
