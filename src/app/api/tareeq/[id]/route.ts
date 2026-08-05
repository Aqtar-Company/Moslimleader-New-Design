export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/tareeq/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // Increment view count (non-blocking)
  prisma.tareeqPost.update({ where: { id: params.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return NextResponse.json({ post });
}

// DELETE /api/tareeq/[id] — owner or admin only
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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
