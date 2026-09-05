export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// PATCH /api/tareeq/message-requests/[requestId]
// body: { action: 'accept' | 'reject' }
// Accept: creates a real conversation and marks request accepted
// Reject: marks request rejected
export async function PATCH(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as 'accept' | 'reject';
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
  }

  const request = await prisma.tareeqMessageRequest.findUnique({ where: { id: params.requestId } });
  if (!request) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (request.toId !== user.userId) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  if (request.status !== 'pending') return NextResponse.json({ error: 'الطلب تمت معالجته' }, { status: 400 });

  if (action === 'reject') {
    await prisma.tareeqMessageRequest.update({
      where: { id: params.requestId },
      data: { status: 'rejected' },
    });
    return NextResponse.json({ ok: true });
  }

  // Accept: create conversation then update request status
  const [pA, pB] = [request.fromId, user.userId].sort();
  const convo = await prisma.tareeqConversation.upsert({
    where: { participantA_participantB: { participantA: pA, participantB: pB } },
    create: { participantA: pA, participantB: pB },
    update: { deletedForA: false, deletedForB: false },
  });

  // Send the request message as the first real message in the conversation
  await prisma.tareeqMessage.create({
    data: { conversationId: convo.id, senderId: request.fromId, content: request.message },
  });
  await prisma.tareeqConversation.update({
    where: { id: convo.id },
    data: { lastMessage: request.message.slice(0, 100), lastMessageAt: new Date() },
  });

  await prisma.tareeqMessageRequest.update({
    where: { id: params.requestId },
    data: { status: 'accepted' },
  });

  return NextResponse.json({ ok: true, conversationId: convo.id });
}
