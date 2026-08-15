export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// POST /api/tareeq/[id]/pin-comment — pin a comment as best reply (owner only)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { commentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { commentId } = body;
  if (!commentId || typeof commentId !== 'string') {
    return NextResponse.json({ error: 'commentId is required' }, { status: 400 });
  }

  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (post.userId !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const comment = await prisma.tareeqComment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true },
  });
  if (!comment || comment.postId !== params.id) {
    return NextResponse.json({ error: 'Comment not found on this post' }, { status: 404 });
  }

  await prisma.tareeqPost.update({
    where: { id: params.id },
    data: { pinnedCommentId: commentId },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/tareeq/[id]/pin-comment — unpin the best reply (owner only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (post.userId !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.tareeqPost.update({
    where: { id: params.id },
    data: { pinnedCommentId: null },
  });

  return NextResponse.json({ ok: true });
}
