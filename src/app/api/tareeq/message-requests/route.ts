export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/tareeq-push';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isBlockedEitherWay, isTareeqSuspended } from '@/lib/tareeq-guard';
import { isGender, isMahramTie, needsRelationDeclaration, type TareeqRelation } from '@/lib/tareeq-gender';

// GET /api/tareeq/message-requests — list incoming pending requests for current user
export async function GET(_req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ requests: [] });

  const requests = await prisma.tareeqMessageRequest.findMany({
    where: { toId: user.userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { from: { select: { id: true, name: true, avatarUrl: true, tareeqGender: true, username: true } } },
  });

  // `relation`, `relationLabel` and `reason` go out with the row: they are what the
  // recipient decides on. A request that arrives as a bare name and a line of text asks
  // her to judge a stranger with nothing to judge by.
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

  const rl = await tareeqRateLimit('msgreq', user.userId, 10, 3_600_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const toId = String(body.toId ?? '').trim();
  const message = String(body.message ?? '').trim().slice(0, 500);

  if (!toId || toId === user.userId) return NextResponse.json({ error: 'معرّف غير صالح' }, { status: 400 });
  if (!message) return NextResponse.json({ error: 'الرسالة فارغة' }, { status: 400 });

  // Verify target user exists before upserting (prevents FK 500 error)
  const target = await prisma.user.findUnique({ where: { id: toId }, select: { id: true, tareeqGender: true } });
  if (!target) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });

  // ── What the sender states about the recipient ────────────────────────────────────────
  // Only across genders. Two men writing to each other are asked nothing: the question
  // exists because of the mixing, and asking it of everyone would make it a formality
  // people click through — which is exactly what would empty it of meaning.
  //
  // NOTHING here is verified, and the design does not pretend otherwise. What it buys is
  // that the claim is SHOWN to the recipient in words before she answers, and stored. A
  // false claim stops being a private lie and becomes something she can report with the
  // claim attached to it.
  const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { tareeqGender: true } });
  let relation: TareeqRelation | null = null;
  let relationLabel: string | null = null;
  let reason: string | null = null;

  if (needsRelationDeclaration(me?.tareeqGender, target.tareeqGender)) {
    const claimed = String(body.relation ?? '').trim();
    if (claimed !== 'spouse' && claimed !== 'mahram' && claimed !== 'none') {
      return NextResponse.json({ error: 'حدّد صلتك بالمُرسَل إليه أولاً' }, { status: 400 });
    }
    relation = claimed;

    if (relation === 'mahram') {
      const tie = String(body.relationLabel ?? '').trim();
      // From the fixed list, not free text: a typed tie is a place to write anything at
      // all, and what the recipient must read is a claim she can recognise at a glance.
      if (!isGender(me?.tareeqGender) || !isMahramTie(me.tareeqGender, tie)) {
        return NextResponse.json({ error: 'اختر صلة القرابة من القائمة' }, { status: 400 });
      }
      relationLabel = tie;
    }

    if (relation === 'none') {
      // Without a stated purpose the recipient is asked to judge a stranger with nothing
      // to judge by, which is how «اقبل؟» becomes a coin toss.
      reason = String(body.reason ?? '').trim().slice(0, 300);
      if (reason.length < 10) {
        return NextResponse.json({ error: 'اكتب سبب الرسالة (١٠ أحرف على الأقل)' }, { status: 400 });
      }
    }
  }

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

  // She was never told. The row was written and the sender was shown «تم إرسال طلبك!
  // سيتمكن X من قبول أو رفض طلبك» — while nothing pushed, nothing appeared in her
  // notifications, and the only badge lives on a tab inside the inbox she had no reason to
  // open. He waits, she never learns, and neither of them can tell which.
  const requestUpsert = prisma.tareeqMessageRequest.upsert({
    where: { fromId_toId: { fromId: user.userId, toId } },
    create: { fromId: user.userId, toId, message, status: 'pending', relation, relationLabel, reason },
    // A re-send replaces the claim too. Leaving the old one would let someone declare a
    // kinship, be refused, and have that declaration still attached to a later request
    // they sent without it.
    update: { message, status: 'pending', relation, relationLabel, reason },
  });
  await requestUpsert;

  // Best effort, and deliberately after the row: a failed push must not lose the request.
  void sendPushToUser(toId, {
    title: 'طلب رسالة جديد',
    body: `${user.name ?? 'أحد الأعضاء'} يطلب مراسلتك`,
    url: '/tareeq/inbox?tab=requests',
    tag: `msgreq-${user.userId}`,
    icon: '/Tareeq-small.png',
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
