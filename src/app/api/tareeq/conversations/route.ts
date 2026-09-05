export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { isBlockedEitherWay } from '@/lib/tareeq-guard';

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
    select: { id: true, name: true, avatarUrl: true },
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
    select: { id: true, tareeqMessagePrivacy: true },
  });
  if (!otherUser) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });

  if (await isBlockedEitherWay(user.userId, otherId)) {
    return NextResponse.json({ error: 'لا يمكن بدء محادثة مع هذا المستخدم' }, { status: 403 });
  }

  const privacy = (otherUser as any).tareeqMessagePrivacy ?? 'everyone';

  if (privacy === 'nobody') {
    return NextResponse.json({ error: 'هذا المستخدم لا يقبل رسائل' }, { status: 403 });
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

  // Always sort alphabetically to ensure deduplication
  const [pA, pB] = [user.userId, otherId].sort();

  const convo = await prisma.tareeqConversation.upsert({
    where: { participantA_participantB: { participantA: pA, participantB: pB } },
    create: { participantA: pA, participantB: pB },
    update: { deletedForA: false, deletedForB: false },
  });

  return NextResponse.json({ conversationId: convo.id });
}
