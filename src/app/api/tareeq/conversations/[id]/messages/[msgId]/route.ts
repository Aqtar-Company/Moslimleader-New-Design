export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// DELETE /api/tareeq/conversations/[id]/messages/[msgId]
// deleteType=everyone: soft-delete for all (tombstone) — sender only
// deleteType=me: hide only for the requesting participant
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; msgId: string } }
) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // Verify participation (prevents enumeration)
  const convo = await prisma.tareeqConversation.findUnique({
    where: { id: params.id },
    select: { participantA: true, participantB: true },
  });
  if (!convo) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (convo.participantA !== user.userId && convo.participantB !== user.userId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const msg = await prisma.tareeqMessage.findUnique({ where: { id: params.msgId } });
  if (!msg || msg.conversationId !== params.id) {
    return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const deleteType: 'me' | 'everyone' = body.deleteType === 'everyone' ? 'everyone' : 'me';
  const isA = convo.participantA === user.userId;

  if (deleteType === 'everyone') {
    // Only the message sender can delete for everyone
    if (msg.senderId !== user.userId) {
      return NextResponse.json({ error: 'يمكنك حذف رسائلك فقط للجميع' }, { status: 403 });
    }
    await prisma.tareeqMessage.update({
      where: { id: params.msgId },
      data: { deletedAt: new Date(), content: '' },
    });
  } else {
    // Hide only for the requesting participant
    await prisma.tareeqMessage.update({
      where: { id: params.msgId },
      data: isA ? { deletedForA: true } : { deletedForB: true },
    });
  }

  // Refresh lastMessage preview — skip tombstones and messages hidden from both
  const latest = await prisma.tareeqMessage.findFirst({
    where: {
      conversationId: params.id,
      deletedAt: null,
      deletedForA: false,
      deletedForB: false,
    },
    orderBy: { createdAt: 'desc' },
    select: { content: true, imageUrl: true, videoUrl: true, audioUrl: true, sharedPostId: true },
  });

  await prisma.tareeqConversation.update({
    where: { id: params.id },
    data: {
      lastMessage: latest
        ? (latest.sharedPostId ? '🔗 منشور' : latest.imageUrl ? '📷 صورة' : latest.videoUrl ? '🎥 فيديو' : latest.audioUrl ? '🎙️ رسالة صوتية' : (latest.content ?? '')).slice(0, 100)
        : null,
    },
  });

  return NextResponse.json({ ok: true });
}
