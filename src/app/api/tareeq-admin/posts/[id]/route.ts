export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';

// GET /api/tareeq-admin/posts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdmin(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      reports: {
        where: { targetType: 'post' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { reporter: { select: { id: true, name: true } } },
      },
    },
  });

  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

  return Response.json({ post });
}

// PATCH /api/tareeq-admin/posts/[id]
// Body: { action: 'hide', reason? } | { action: 'unhide' } | { action: 'delete' }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdmin(request);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { action, reason } = body as { action?: string; reason?: string };

  if (!action || !['hide', 'unhide', 'delete'].includes(action)) {
    return Response.json({ error: 'Invalid action' }, { status: 400 });
  }

  const existing = await prisma.tareeqPost.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: 'Post not found' }, { status: 404 });

  if (action === 'delete') {
    await prisma.tareeqPost.delete({ where: { id: params.id } });
    await logAudit(admin.id, 'posts.delete', { postId: params.id });
    return Response.json({ ok: true });
  }

  if (action === 'hide') {
    await prisma.tareeqPost.update({
      where: { id: params.id },
      data: {
        isHidden: true,
        hiddenBy: admin.id,
        hiddenReason: reason ?? null,
      },
    });
    await logAudit(admin.id, 'posts.hide', { postId: params.id, reason });
    return Response.json({ ok: true });
  }

  // unhide
  await prisma.tareeqPost.update({
    where: { id: params.id },
    data: {
      isHidden: false,
      hiddenBy: null,
      hiddenReason: null,
    },
  });
  await logAudit(admin.id, 'posts.unhide', { postId: params.id });
  return Response.json({ ok: true });
}
