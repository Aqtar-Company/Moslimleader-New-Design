export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-push-unsub:${ip}`, 10, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

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
