export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// DELETE /api/tareeq/conversations/[id]/messages/[msgId]
// Soft-deletes a message (own messages only). Updates conversation lastMessage preview.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; msgId: string } }
) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const msg = await prisma.tareeqMessage.findUnique({ where: { id: params.msgId } });
  if (!msg) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (msg.conversationId !== params.id) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (msg.senderId !== user.userId) return NextResponse.json({ error: 'يمكنك فقط حذف رسائلك' }, { status: 403 });

  await prisma.tareeqMessage.update({
    where: { id: params.msgId },
    data: { deletedAt: new Date(), content: '' },
  });

  // Refresh lastMessage preview in conversation
  const latest = await prisma.tareeqMessage.findFirst({
    where: { conversationId: params.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { content: true, imageUrl: true, videoUrl: true, audioUrl: true, sharedPostId: true },
  });

  if (latest) {
    const preview = latest.sharedPostId ? '🔗 منشور' : latest.imageUrl ? '📷 صورة' : latest.videoUrl ? '🎥 فيديو' : latest.audioUrl ? '🎙️ رسالة صوتية' : (latest.content ?? '');
    await prisma.tareeqConversation.update({
      where: { id: params.id },
      data: { lastMessage: preview.slice(0, 100) },
    });
  } else {
    await prisma.tareeqConversation.update({
      where: { id: params.id },
      data: { lastMessage: null },
    });
  }

  return NextResponse.json({ ok: true });
}
