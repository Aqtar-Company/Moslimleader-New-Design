export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendPushToUser } from '@/lib/tareeq-push';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-gmsg:${ip}`, 60, 600_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const member = await prisma.tareeqGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
  });
  if (!member) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const content  = String(body.content  ?? '').trim();
  const imageUrl = String(body.imageUrl ?? '').trim() || null;
  const videoUrl = String(body.videoUrl ?? '').trim() || null;
  const audioUrl = String(body.audioUrl ?? '').trim() || null;

  const hasMedia = !!(imageUrl || videoUrl || audioUrl);
  if (!hasMedia && content.length < 1) return NextResponse.json({ error: 'الرسالة فارغة' }, { status: 400 });
  if (content.length > 2000) return NextResponse.json({ error: 'الرسالة طويلة جداً' }, { status: 400 });

  const lastPreview = audioUrl ? '🎙 رسالة صوتية' : imageUrl ? '📷 صورة' : videoUrl ? '🎥 فيديو' : content;

  const [message] = await prisma.$transaction([
    prisma.tareeqGroupMessage.create({
      data: { groupId: params.id, senderId: user.userId, content, imageUrl, videoUrl, audioUrl },
      select: {
        id: true, content: true, imageUrl: true, videoUrl: true, audioUrl: true,
        createdAt: true, senderId: true,
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.tareeqGroup.update({
      where: { id: params.id },
      data: { lastMessage: lastPreview.slice(0, 100), lastMessageAt: new Date() },
    }),
  ]);

  // Push to all other members (non-blocking)
  prisma.tareeqGroupMember.findMany({
    where: { groupId: params.id, userId: { not: user.userId } },
    select: { userId: true },
  }).then(others => {
    const preview = audioUrl ? '🎙 رسالة صوتية' : imageUrl ? '📷 صورة' : videoUrl ? '🎥 فيديو' : content.slice(0, 80);
    for (const o of others) {
      sendPushToUser(o.userId, {
        title: user.name ?? 'رسالة مجموعة',
        body: preview,
        url: `/tareeq/groups/${params.id}`,
        tag: `gmsg-${params.id}`,
      }).catch(() => {});
    }
  }).catch(() => {});

  return NextResponse.json({ ok: true, message });
}
