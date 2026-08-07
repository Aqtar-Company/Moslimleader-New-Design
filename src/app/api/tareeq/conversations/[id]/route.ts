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
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, content: true, imageUrl: true, videoUrl: true, read: true, createdAt: true, senderId: true,
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
    select: { id: true, name: true, avatarUrl: true },
  });

  const nextCursor = messages.length === limit ? messages[messages.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({
    messages: messages.reverse(),
    nextCursor,
    otherUser: otherUser ?? { id: otherId, name: 'مستخدم', avatarUrl: null },
  });
}
