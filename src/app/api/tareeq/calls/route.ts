import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { isBlockedEitherWay } from '@/lib/tareeq-guard';
import { sendPushToUser } from '@/lib/tareeq-push';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST — initiate a call (offer is NOT sent here; the call screen POSTs it via PATCH setOffer)
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 5 calls per minute per caller
  const rl = checkRateLimit(`tareeq-call:${user.userId}`, 5, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { calleeId, type = 'audio' } = await req.json();
  if (!calleeId) return NextResponse.json({ error: 'calleeId required' }, { status: 400 });
  if (calleeId === user.userId) return NextResponse.json({ error: 'Cannot call yourself' }, { status: 400 });

  const callee = await prisma.user.findUnique({ where: { id: calleeId }, select: { id: true } });
  if (!callee) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // ── A call is a message that rings ─────────────────────────────────────────────────────
  //
  // This route checked only that the callee existed. Everything the messaging side
  // enforces — blocking, the privacy setting, the kinship question — was absent, and a
  // call is the LOUDER contact: it takes over the screen and rings. So a person someone
  // had blocked could still ring them, and a woman told that a message from a man is
  // preceded by a question about kinship could receive an unsolicited video call instead.
  //
  // The rule used here is deliberately simple and hard to get around: you may call someone
  // you already have a conversation with. Everything that decides who may open a
  // conversation — blocks, privacy, the declaration — is therefore enforced once, on that
  // route, instead of being restated here where it would drift.
  if (await isBlockedEitherWay(user.userId, calleeId)) {
    return NextResponse.json({ error: 'لا يمكن الاتصال بهذا المستخدم' }, { status: 403 });
  }
  const [pA, pB] = [user.userId, calleeId].sort();
  const convo = await prisma.tareeqConversation.findUnique({
    where: { participantA_participantB: { participantA: pA, participantB: pB } },
    select: { id: true },
  });
  if (!convo) {
    return NextResponse.json({ error: 'ابدأ محادثة أولاً قبل الاتصال' }, { status: 403 });
  }

  // End any stale ringing calls from this caller (> 60s old)
  await prisma.tareeqCall.updateMany({
    where: { callerId: user.userId, status: 'ringing', createdAt: { lt: new Date(Date.now() - 90_000) } },
    data: { status: 'missed' },
  });

  const call = await prisma.tareeqCall.create({
    data: { callerId: user.userId, calleeId, type, callerIce: [] },
  });

  // Push notification to callee — title = call type, body = caller name
  sendPushToUser(calleeId, {
    title: type === 'video' ? '📹 مكالمة فيديو واردة' : '📞 مكالمة صوتية واردة',
    body: `${user.name ?? ''} يتصل بك`,
    url: `/tareeq?callId=${call.id}`,
    tag: `call-${call.id}`,
    type: 'call' as const,
    callId: call.id,
  }).catch(() => {});

  return NextResponse.json({ callId: call.id });
}
