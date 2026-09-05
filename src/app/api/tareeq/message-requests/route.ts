export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isBlockedEitherWay, isTareeqSuspended } from '@/lib/tareeq-guard';

// GET /api/tareeq/message-requests — list incoming pending requests for current user
export async function GET(_req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ requests: [] });

  const requests = await prisma.tareeqMessageRequest.findMany({
    where: { toId: user.userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { from: { select: { id: true, name: true, avatarUrl: true, username: true } } },
  });

  return NextResponse.json({ requests });
}

// POST /api/tareeq/message-requests — create a message request
// body: { toId, message }
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  if (await isTareeqSuspended(user.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const rl = tareeqRateLimit('msgreq', user.userId, 10, 3_600_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const toId = String(body.toId ?? '').trim();
  const message = String(body.message ?? '').trim().slice(0, 500);

  if (!toId || toId === user.userId) return NextResponse.json({ error: 'معرّف غير صالح' }, { status: 400 });
  if (!message) return NextResponse.json({ error: 'الرسالة فارغة' }, { status: 400 });

  // Verify target user exists before upserting (prevents FK 500 error)
  const target = await prisma.user.findUnique({ where: { id: toId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });

  if (await isBlockedEitherWay(user.userId, toId)) {
    return NextResponse.json({ error: 'لا يمكن إرسال طلب لهذا المستخدم' }, { status: 403 });
  }

  await prisma.tareeqMessageRequest.upsert({
    where: { fromId_toId: { fromId: user.userId, toId } },
    create: { fromId: user.userId, toId, message, status: 'pending' },
    update: { message, status: 'pending' },
  });

  return NextResponse.json({ ok: true });
}
