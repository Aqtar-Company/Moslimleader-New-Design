export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

// POST /api/tareeq/[id]/subscribe — toggle subscription to post notifications
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = checkRateLimit(`tareeq-subscribe:${user.userId}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const existing = await prisma.tareeqPostSubscription.findUnique({
    where: { postId_userId: { postId: params.id, userId: user.userId } },
  });

  if (existing) {
    await prisma.tareeqPostSubscription.delete({
      where: { postId_userId: { postId: params.id, userId: user.userId } },
    });
    return NextResponse.json({ ok: true, subscribed: false });
  }

  await prisma.tareeqPostSubscription.create({
    data: { postId: params.id, userId: user.userId },
  });
  return NextResponse.json({ ok: true, subscribed: true });
}

// GET /api/tareeq/[id]/subscribe — check whether the current user is subscribed
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.tareeqPostSubscription.findUnique({
    where: { postId_userId: { postId: params.id, userId: user.userId } },
  });

  return NextResponse.json({ subscribed: existing !== null });
}
