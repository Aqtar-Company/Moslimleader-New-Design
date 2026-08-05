export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/tareeq/[id] — returns post + userLiked + userBookmarked
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true, content: true, createdAt: true, userId: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // Increment view count (non-blocking)
  prisma.tareeqPost.update({ where: { id: params.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  // Check if current user already liked/bookmarked
  let userLiked = false;
  let userBookmarked = false;
  try {
    const currentUser = await getAuthUser();
    const [like, bookmark] = await Promise.all([
      prisma.tareeqLike.findUnique({ where: { postId_userId: { postId: params.id, userId: currentUser.userId } } }),
      prisma.tareeqBookmark.findUnique({ where: { postId_userId: { postId: params.id, userId: currentUser.userId } } }),
    ]);
    userLiked = !!like;
    userBookmarked = !!bookmark;
  } catch { /* not logged in — defaults stay false */ }

  return NextResponse.json({ post, userLiked, userBookmarked });
}

// PUT /api/tareeq/[id] — edit (owner only)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-edit:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (post.userId !== user.userId) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  const title = String(body.title ?? '').trim() || null;

  if (content.length < 10) return NextResponse.json({ error: 'اكتب أكثر' }, { status: 400 });
  if (content.length > 5000) return NextResponse.json({ error: 'النص طويل جداً' }, { status: 400 });

  await prisma.tareeqPost.update({
    where: { id: params.id },
    data: { content, title, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/tareeq/[id] — owner or admin only
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-delete:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  if (post.userId !== user.userId && user.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  await prisma.tareeqPost.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
