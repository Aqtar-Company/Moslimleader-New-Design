export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/tareeq/conversations/[id] — messages in conversation
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const convo = await prisma.tareeqConversation.findUnique({ where: { id: params.id } });
  if (!convo) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (convo.participantA !== user.userId && convo.participantB !== user.userId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const limit = 30;

  const messages = await prisma.tareeqMessage.findMany({
    where: {
      conversationId: params.id,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, content: true, imageUrl: true, videoUrl: true, audioUrl: true, read: true, createdAt: true, senderId: true,
      replyToId: true, replyToContent: true, sharedPostId: true, sharedPostTitle: true, sharedPostImageUrl: true,
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  // Mark only the fetched unread messages as read (not beyond the page window)
  const unreadIds = messages.filter(m => !m.read && m.senderId !== user.userId).map(m => m.id);
  if (unreadIds.length > 0) {
    await prisma.tareeqMessage.updateMany({
      where: { id: { in: unreadIds } },
      data: { read: true },
    });
  }

  const otherId = convo.participantA === user.userId ? convo.participantB : convo.participantA;
  const otherUser = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true, avatarUrl: true, tareeqLastSeen: true },
  });

  const nextCursor = messages.length === limit ? messages[messages.length - 1].createdAt.toISOString() : null;

  // Fetch calls only on the first load (no cursor) — polling updates use a separate
  // callCount check on the client; this keeps the poll query cheap.
  let calls: object[] = [];
  if (!cursor) {
    calls = await prisma.tareeqCall.findMany({
      where: {
        OR: [
          { callerId: user.userId, calleeId: otherId },
          { callerId: otherId, calleeId: user.userId },
        ],
        status: { in: ['ended', 'missed', 'rejected'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, status: true, callerId: true, startedAt: true, endedAt: true, createdAt: true },
      take: 100,
    });
  }

  return NextResponse.json({
    messages: messages.reverse(),
    calls,
    nextCursor,
    otherUser: otherUser ?? { id: otherId, name: 'مستخدم', avatarUrl: null },
  });
}

// DELETE /api/tareeq/conversations/[id] — soft-delete conversation for current user
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const convo = await prisma.tareeqConversation.findUnique({ where: { id: params.id } });
  if (!convo) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (convo.participantA !== user.userId && convo.participantB !== user.userId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const isA = convo.participantA === user.userId;
  await prisma.tareeqConversation.update({
    where: { id: params.id },
    data: isA ? { deletedForA: true } : { deletedForB: true },
  });

  // If both sides deleted, hard-delete the whole conversation
  const refreshed = await prisma.tareeqConversation.findUnique({ where: { id: params.id } });
  if (refreshed && refreshed.deletedForA && refreshed.deletedForB) {
    await prisma.tareeqConversation.delete({ where: { id: params.id } });
  }

  return NextResponse.json({ ok: true });
}
