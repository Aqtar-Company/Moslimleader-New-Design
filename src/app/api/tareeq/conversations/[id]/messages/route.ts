export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendPushToUser } from '@/lib/tareeq-push';

// POST /api/tareeq/conversations/[id]/messages — send message
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-msg:${ip}`, 30, 600_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const convo = await prisma.tareeqConversation.findUnique({ where: { id: params.id } });
  if (!convo) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (convo.participantA !== user.userId && convo.participantB !== user.userId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  const imageUrl = String(body.imageUrl ?? '').trim() || null;
  const videoUrl = String(body.videoUrl ?? '').trim() || null;

  const hasMedia = !!(imageUrl || videoUrl);
  if (!hasMedia && content.length < 1) return NextResponse.json({ error: 'الرسالة فارغة' }, { status: 400 });
  if (content.length > 2000) return NextResponse.json({ error: 'الرسالة طويلة جداً' }, { status: 400 });

  const otherId = convo.participantA === user.userId ? convo.participantB : convo.participantA;
  const lastMsgPreview = imageUrl ? '📷 صورة' : videoUrl ? '🎥 فيديو' : content;

  const [message] = await prisma.$transaction([
    prisma.tareeqMessage.create({
      data: { conversationId: params.id, senderId: user.userId, content, imageUrl, videoUrl },
      select: {
        id: true, content: true, imageUrl: true, videoUrl: true, read: true, createdAt: true, senderId: true,
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.tareeqConversation.update({
      where: { id: params.id },
      data: { lastMessage: lastMsgPreview.slice(0, 100), lastMessageAt: new Date() },
    }),
  ]);

  // Push notification to recipient (non-blocking, always send — messages feel urgent)
  sendPushToUser(otherId, {
    title: user.name ?? 'رسالة جديدة',
    body: (imageUrl ? '📷 صورة' : videoUrl ? '🎥 فيديو' : content).slice(0, 80),
    url: `/tareeq/inbox/${params.id}`,
    tag: `msg-${params.id}`,
    type: 'message',
  }).catch(() => {});

  // In-app notification at most once per 5 minutes (non-blocking)
  prisma.tareeqNotification.findFirst({
    where: {
      userId: otherId,
      actorId: user.userId,
      type: 'message',
      createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    select: { id: true },
  }).then(existing => {
    if (!existing) {
      return prisma.tareeqNotification.create({
        data: {
          userId: otherId,
          type: 'message',
          actorId: user.userId,
          actorName: user.name ?? null,
          body: content.slice(0, 80),
        },
      });
    }
  }).catch(() => {});

  return NextResponse.json({ ok: true, message });
}
