export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const rl = tareeqRateLimit('push-unsub', user.userId, 10, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const endpoint = body.endpoint;
  if (!endpoint) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });

  await prisma.tareeqPushSubscription.deleteMany({
    where: { userId: user.userId, endpoint },
  });

  return NextResponse.json({ ok: true });
}
