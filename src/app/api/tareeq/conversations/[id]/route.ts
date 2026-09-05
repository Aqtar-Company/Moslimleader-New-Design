export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { isBlockedEitherWay } from '@/lib/tareeq-guard';

// GET /api/tareeq/conversations/[id] — messages in conversation
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const convo = await prisma.tareeqConversation.findUnique({ where: { id: params.id } });
  if (!convo) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (convo.participantA !== user.userId && convo.participantB !== user.userId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const otherId = convo.participantA === user.userId ? convo.participantB : convo.participantA;
  if (await isBlockedEitherWay(user.userId, otherId)) {
    return NextResponse.json({ error: 'لا يمكن الوصول لهذه المحادثة' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const limit = 30;

  const isA = convo.participantA === user.userId;

  const rawMessages = await prisma.tareeqMessage.findMany({
    where: {
      conversationId: params.id,
      // Exclude messages the current user deleted for themselves; keep tombstones (deletedAt != null)
      ...(isA ? { deletedForA: false } : { deletedForB: false }),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, content: true, imageUrl: true, videoUrl: true, audioUrl: true, read: true, createdAt: true, senderId: true,
      replyToId: true, replyToContent: true, sharedPostId: true, sharedPostTitle: true, sharedPostImageUrl: true,
      deletedAt: true,
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  // Shape messages: tombstones lose media/content, expose isDeletedForEveryone flag
  const messages = rawMessages.map(m => {
    if (m.deletedAt) {
      return {
        id: m.id, content: '', imageUrl: null, videoUrl: null, audioUrl: null,
        read: m.read, createdAt: m.createdAt, senderId: m.senderId, sender: m.sender,
        replyToId: null, replyToContent: null, sharedPostId: null, sharedPostTitle: null, sharedPostImageUrl: null,
        isDeletedForEveryone: true,
      };
    }
    const { deletedAt: _d, ...rest } = m;
    return { ...rest, isDeletedForEveryone: false };
  });

  // Mark only the fetched unread messages as read (not beyond the page window)
  const unreadIds = messages.filter(m => !m.read && m.senderId !== user.userId).map(m => m.id);
  if (unreadIds.length > 0) {
    await prisma.tareeqMessage.updateMany({
      where: { id: { in: unreadIds } },
      data: { read: true },
    });
  }

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
// Uses a transaction to avoid TOCTOU race when both sides delete simultaneously.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const convo = await prisma.tareeqConversation.findUnique({ where: { id: params.id } });
  if (!convo) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (convo.participantA !== user.userId && convo.participantB !== user.userId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const isA = convo.participantA === user.userId;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.tareeqConversation.update({
        where: { id: params.id },
        data: isA ? { deletedForA: true } : { deletedForB: true },
      });
      if (updated.deletedForA && updated.deletedForB) {
        await tx.tareeqConversation.delete({ where: { id: params.id } });
      }
    });
  } catch (e: any) {
    // P2025 = record not found — already hard-deleted by the other side, which is fine
    if (e?.code !== 'P2025') throw e;
  }

  return NextResponse.json({ ok: true });
}
