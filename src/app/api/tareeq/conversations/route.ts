export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { isBlockedEitherWay } from '@/lib/tareeq-guard';
import { needsRelationDeclaration } from '@/lib/tareeq-gender';

// GET /api/tareeq/conversations — list current user's conversations
// ?countOnly=true → returns { unreadCount: N } cheaply
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ conversations: [], unreadCount: 0 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get('countOnly') === 'true') {
    const unreadCount = await prisma.tareeqMessage.count({
      where: {
        senderId: { not: user.userId },
        read: false,
        deletedAt: null,
        conversation: {
          OR: [
            { participantA: user.userId, deletedForA: false },
            { participantB: user.userId, deletedForB: false },
          ],
        },
      },
    });
    return NextResponse.json({ unreadCount });
  }

  const convos = await prisma.tareeqConversation.findMany({
    where: {
      OR: [
        { participantA: user.userId, deletedForA: false },
        { participantB: user.userId, deletedForB: false },
      ],
    },
    orderBy: { lastMessageAt: 'desc' },
  });

  // Enrich with other participant info
  const otherIds = convos.map(c =>
    c.participantA === user.userId ? c.participantB : c.participantA
  );
  const uniqueIds = [...new Set(otherIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, avatarUrl: true, tareeqGender: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  // Count unread messages for all conversations in one grouped query (avoids N+1)
  const convoIds = convos.map(c => c.id);
  const unreadGroups = await prisma.tareeqMessage.groupBy({
    by: ['conversationId'],
    where: { conversationId: { in: convoIds }, senderId: { not: user.userId }, read: false, deletedAt: null },
    _count: { id: true },
  });
  const unreadMap = Object.fromEntries(unreadGroups.map(g => [g.conversationId, g._count.id]));

  const conversations = convos.map(c => {
    const otherId = c.participantA === user.userId ? c.participantB : c.participantA;
    return {
      id: c.id,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      unreadCount: unreadMap[c.id] ?? 0,
      otherUser: userMap[otherId] ?? { id: otherId, name: 'مستخدم', avatarUrl: null },
    };
  });

  return NextResponse.json({ conversations });
}

// POST /api/tareeq/conversations — start/find conversation
// body: { userId: string }
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const otherId = String(body.userId ?? '').trim();
  if (!otherId || otherId === user.userId) {
    return NextResponse.json({ error: 'معرّف غير صالح' }, { status: 400 });
  }

  const otherUser = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, tareeqMessagePrivacy: true, tareeqGender: true },
  });
  if (!otherUser) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });

  if (await isBlockedEitherWay(user.userId, otherId)) {
    return NextResponse.json({ error: 'لا يمكن بدء محادثة مع هذا المستخدم' }, { status: 403 });
  }

  // Always sort alphabetically to ensure deduplication.
  const [pA, pB] = [user.userId, otherId].sort();

  // An EXISTING conversation always reopens, whatever the privacy setting now says —
  // these two have already talked. Checking this before the privacy branch is what stops
  // a "followers only" user's past correspondents from being bounced to the message-request
  // flow (which then answers "you already have a conversation") with no way through.
  const existing = await prisma.tareeqConversation.findUnique({
    where: { participantA_participantB: { participantA: pA, participantB: pB } },
    select: { id: true },
  });
  if (existing) {
    await prisma.tareeqConversation.update({
      where: { id: existing.id },
      data: pA === user.userId ? { deletedForA: false } : { deletedForB: false },
    });
    return NextResponse.json({ conversationId: existing.id });
  }

  // Not `as any`: this is the route the entire declaration gate hangs on, and the cast
  // would hide the day somebody trims either field out of the select above.
  const privacy = otherUser.tareeqMessagePrivacy ?? 'everyone';

  if (privacy === 'nobody') {
    return NextResponse.json({ error: 'هذا المستخدم لا يقبل رسائل' }, { status: 403 });
  }

  // ── The kinship question is enforced HERE, not only on the message-request route ──────
  //
  // It was enforced only there, and this route is the one the «رسالة» button actually
  // calls. Since `tareeqMessagePrivacy` defaults to 'everyone' on every account, the
  // default path fell straight through to creating a conversation: a man opened any
  // woman's profile, tapped once, and was typing to her — with no declaration, no request
  // row, and nothing for her to accept or refuse. The whole declaration flow was
  // unreachable for anyone who had not manually changed a setting they are never shown.
  //
  // 'followers' did not save it either: following someone is one unrestricted tap, so a
  // man who wanted past the question simply followed first.
  //
  // So: a cross-gender pair with no history goes through a request, whatever the privacy
  // setting says. An EXISTING conversation is untouched — it returns above, before this —
  // because these two have already agreed to talk.
  const meRow = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { tareeqGender: true },
  });
  if (needsRelationDeclaration(meRow?.tareeqGender, otherUser.tareeqGender)) {
    const accepted = await prisma.tareeqMessageRequest.findUnique({
      where: { fromId_toId: { fromId: user.userId, toId: otherId } },
      select: { status: true },
    });
    // Her own accepted request in the other direction counts: if she wrote to him and he
    // accepted, refusing to let him reply would be absurd.
    const acceptedBack = accepted?.status === 'accepted' ? null : await prisma.tareeqMessageRequest.findUnique({
      where: { fromId_toId: { fromId: otherId, toId: user.userId } },
      select: { status: true },
    });
    if (accepted?.status !== 'accepted' && acceptedBack?.status !== 'accepted') {
      return NextResponse.json({ requestRequired: true, reason: 'relation' }, { status: 202 });
    }
  }

  if (privacy === 'followers') {
    // Check if the sender follows the target — "followers only" means only people who follow the target can message them
    const isFollower = await prisma.tareeqFollow.findUnique({
      where: { followerId_followingId: { followerId: user.userId, followingId: otherId } },
    });
    if (!isFollower) {
      // Route to message request instead of direct conversation
      return NextResponse.json({ requestRequired: true }, { status: 202 });
    }
  }

  // Nothing existed — create it. (Un-hiding is handled by the early-return above; a
  // brand-new row has both flags false. The other side is un-hidden only when a real
  // message is sent, see messages/route.ts, so merely opening a thread no longer
  // resurrects it in the other person's inbox.)
  const convo = await prisma.tareeqConversation.upsert({
    where: { participantA_participantB: { participantA: pA, participantB: pB } },
    create: { participantA: pA, participantB: pB },
    update: {}, // no-op: still an upsert so two concurrent opens can't hit the unique constraint
  });

  return NextResponse.json({ conversationId: convo.id });
}
