export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended, isBlockedEitherWay } from '@/lib/tareeq-guard';
import { sendPushToUser } from '@/lib/tareeq-push';

// POST /api/tareeq/conversations/[id]/messages — send message
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const rl = tareeqRateLimit('msg', user.userId, 30, 600_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(user.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const convo = await prisma.tareeqConversation.findUnique({ where: { id: params.id } });
  if (!convo) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (convo.participantA !== user.userId && convo.participantB !== user.userId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const otherParticipant = convo.participantA === user.userId ? convo.participantB : convo.participantA;
  if (await isBlockedEitherWay(user.userId, otherParticipant)) {
    return NextResponse.json({ error: 'لا يمكن إرسال رسالة لهذا المستخدم' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  const imageUrl = String(body.imageUrl ?? '').trim() || null;
  const videoUrl = String(body.videoUrl ?? '').trim() || null;
  const audioUrl = String(body.audioUrl ?? '').trim() || null;
  const replyToId: string | null = body.replyToId || null;
  const sharedPostId: string | null = body.sharedPostId || null;
  const sharedPostTitle: string | null = body.sharedPostTitle || null;
  const sharedPostImageUrl: string | null = body.sharedPostImageUrl || null;

  const hasMedia = !!(imageUrl || videoUrl || audioUrl);
  const hasSharedPost = !!sharedPostId;
  if (!hasMedia && !hasSharedPost && content.length < 1) return NextResponse.json({ error: 'الرسالة فارغة' }, { status: 400 });
  if (content.length > 2000) return NextResponse.json({ error: 'الرسالة طويلة جداً' }, { status: 400 });

  // Fetch reply preview (denormalized so we don't need a join when rendering)
  let replyToContent: string | null = null;
  if (replyToId) {
    const original = await prisma.tareeqMessage.findFirst({
      where: { id: replyToId, conversationId: params.id },
      select: { content: true, imageUrl: true, audioUrl: true, videoUrl: true },
    });
    if (original) {
      replyToContent = original.content?.trim() || (original.imageUrl ? '📷' : original.videoUrl ? '🎥' : original.audioUrl ? '🎙️' : '');
    }
  }

  // Validate shared post exists
  if (sharedPostId) {
    const post = await prisma.tareeqPost.findUnique({ where: { id: sharedPostId }, select: { id: true } });
    if (!post) return NextResponse.json({ error: 'المنشور غير موجود' }, { status: 404 });
  }

  const otherId = convo.participantA === user.userId ? convo.participantB : convo.participantA;
  const lastMsgPreview = sharedPostId ? '🔗 منشور' : imageUrl ? '📷 صورة' : videoUrl ? '🎥 فيديو' : audioUrl ? '🎙️ رسالة صوتية' : content;

  const [message] = await prisma.$transaction([
    prisma.tareeqMessage.create({
      data: {
        conversationId: params.id, senderId: user.userId, content, imageUrl, videoUrl, audioUrl,
        ...(replyToId ? { replyToId, replyToContent } : {}),
        ...(sharedPostId ? { sharedPostId, sharedPostTitle, sharedPostImageUrl } : {}),
      },
      select: {
        id: true, content: true, imageUrl: true, videoUrl: true, audioUrl: true, read: true, createdAt: true, senderId: true,
        replyToId: true, replyToContent: true, sharedPostId: true, sharedPostTitle: true, sharedPostImageUrl: true,
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
    body: (imageUrl ? '📷 صورة' : videoUrl ? '🎥 فيديو' : audioUrl ? '🎙️ رسالة صوتية' : content).slice(0, 80),
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
          postId: params.id,   // conversationId — used to navigate directly on click
          body: content.slice(0, 80),
        },
      });
    }
  }).catch(() => {});

  return NextResponse.json({ ok: true, message });
}
