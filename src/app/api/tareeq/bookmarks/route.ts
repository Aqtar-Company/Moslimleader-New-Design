import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/tareeq/bookmarks?folderId=xxx  — list saved posts (optionally in a folder)
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get('folderId') || undefined;

  const bookmarks = await prisma.tareeqBookmark.findMany({
    where: { userId: user.userId, folderId: folderId ?? undefined },
    orderBy: { createdAt: 'desc' },
    take: 100,
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

  return NextResponse.json({ bookmarks });
}

// POST /api/tareeq/bookmarks  — save a post
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { postId, folderId } = await req.json();
  if (!postId) return NextResponse.json({ error: 'postId مطلوب' }, { status: 400 });

  const post = await prisma.tareeqPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: 'المنشور غير موجود' }, { status: 404 });

  if (folderId) {
    const folder = await prisma.tareeqBookmarkFolder.findFirst({ where: { id: folderId, userId: user.userId } });
    if (!folder) return NextResponse.json({ error: 'التصنيف غير موجود' }, { status: 404 });
  }

  const bookmark = await prisma.tareeqBookmark.upsert({
    where: { postId_userId: { postId, userId: user.userId } },
    update: { folderId: folderId ?? null },
    create: { postId, userId: user.userId, folderId: folderId ?? null },
  });

  return NextResponse.json({ bookmark });
}

// DELETE /api/tareeq/bookmarks?postId=xxx  — unsave a post
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const postId = searchParams.get('postId');
  if (!postId) return NextResponse.json({ error: 'postId مطلوب' }, { status: 400 });

  await prisma.tareeqBookmark.deleteMany({ where: { postId, userId: user.userId } });

  return NextResponse.json({ ok: true });
}
