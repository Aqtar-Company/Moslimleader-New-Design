import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const LIMIT = 50;

// GET /api/tareeq/bookmarks?folderId=xxx&cursor=xxx  — list saved posts
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get('folderId') || undefined;
  const cursor   = searchParams.get('cursor') || undefined;

  const bookmarks = await prisma.tareeqBookmark.findMany({
    where: { userId: user.userId, folderId: folderId ?? undefined },
    orderBy: { createdAt: 'desc' },
    take: LIMIT + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      folder: { select: { id: true, name: true } },
      post: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { likes: true, comments: true } },
        },
      },
    },
  });

  const hasMore    = bookmarks.length > LIMIT;
  const items      = hasMore ? bookmarks.slice(0, LIMIT) : bookmarks;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ bookmarks: items, nextCursor });
}

// POST /api/tareeq/bookmarks  — save a post
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = checkRateLimit(`bookmark:${user.userId}`, 60, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: 'الرجاء الانتظار قليلاً' }, { status: 429 });

  const { postId, folderId } = await req.json();
  if (!postId) return NextResponse.json({ error: 'postId مطلوب' }, { status: 400 });

  const post = await prisma.tareeqPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: 'المنشور غير موجود' }, { status: 404 });

  if (folderId) {
    const folder = await prisma.tareeqBookmarkFolder.findFirst({ where: { id: folderId, userId: user.userId } });
    if (!folder) return NextResponse.json({ error: 'التصنيف غير موجود' }, { status: 404 });
  }

  const existing = await prisma.tareeqBookmark.findUnique({
    where: { postId_userId: { postId, userId: user.userId } },
    select: { id: true },
  });

  const bookmark = await prisma.tareeqBookmark.upsert({
    where: { postId_userId: { postId, userId: user.userId } },
    update: { folderId: folderId ?? null },
    create: { postId, userId: user.userId, folderId: folderId ?? null },
  });

  if (!existing) {
    await prisma.tareeqPost.update({ where: { id: postId }, data: { savedCount: { increment: 1 } } }).catch(() => {});
  }

  return NextResponse.json({ bookmark });
}

// DELETE /api/tareeq/bookmarks?postId=xxx  — unsave a post
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const postId = searchParams.get('postId');
  if (!postId) return NextResponse.json({ error: 'postId مطلوب' }, { status: 400 });

  const deleted = await prisma.tareeqBookmark.deleteMany({ where: { postId, userId: user.userId } });

  if (deleted.count > 0) {
    await prisma.tareeqPost.updateMany({ where: { id: postId, savedCount: { gt: 0 } }, data: { savedCount: { decrement: 1 } } }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
