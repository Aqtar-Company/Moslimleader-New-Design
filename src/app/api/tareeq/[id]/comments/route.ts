export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/tareeq/[id]/comments
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const comments = await prisma.tareeqComment.findMany({
    where: { postId: params.id },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ comments });
}

// POST /api/tareeq/[id]/comments
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-comment:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();

  if (content.length < 2) return NextResponse.json({ error: 'اكتب تعليقك' }, { status: 400 });
  if (content.length > 500) return NextResponse.json({ error: 'التعليق طويل جداً' }, { status: 400 });

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });

  const comment = await prisma.tareeqComment.create({
    data: { postId: params.id, userId: user.userId, content },
    select: {
      id: true, content: true, createdAt: true, userId: true,
      user: { select: { id: true, name: true } },
    },
  });

  await prisma.tareeqPost.update({ where: { id: params.id }, data: { commentCount: { increment: 1 } } });

  return NextResponse.json({ ok: true, comment });
}
