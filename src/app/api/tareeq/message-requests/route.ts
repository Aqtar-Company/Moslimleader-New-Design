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

  // A previously rejected request must NOT be resurrected by simply sending again —
  // otherwise "decline" means nothing and the sender can keep re-requesting.
  const prior = await prisma.tareeqMessageRequest.findUnique({
    where: { fromId_toId: { fromId: user.userId, toId } },
    select: { status: true, updatedAt: true },
  });

  // Time-boxed, not permanent: the row is unique per (fromId, toId) and the recipient has
  // no UI to clear it, so a terminal 'rejected' would silence that person for life over a
  // single mis-tap. A permanent silence is what TareeqBlock is for — and it is already
  // enforced above on every path.
  if (prior?.status === 'rejected') {
    const cooldownEnds = new Date(prior.updatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (cooldownEnds > new Date()) {
      return NextResponse.json({ error: 'لا يمكن إرسال طلب آخر لهذا المستخدم حالياً' }, { status: 403 });
    }
  }

  // 'accepted' normally means a live conversation — hand back its id so the client can
  // just open it. But conversations are HARD-deleted once both sides delete them
  // (conversations/[id]/route.ts), while this row stays 'accepted' forever. Answering
  // "you already have a conversation" in that case is both untrue and a dead end, so fall
  // through and let the request go out again.
  if (prior?.status === 'accepted') {
    const [pA, pB] = [user.userId, toId].sort();
    const existing = await prisma.tareeqConversation.findUnique({
      where: { participantA_participantB: { participantA: pA, participantB: pB } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, conversationId: existing.id, alreadyAccepted: true });
    }
  }

  await prisma.tareeqMessageRequest.upsert({
    where: { fromId_toId: { fromId: user.userId, toId } },
    create: { fromId: user.userId, toId, message, status: 'pending' },
    update: { message, status: 'pending' },
  });

  return NextResponse.json({ ok: true });
}
