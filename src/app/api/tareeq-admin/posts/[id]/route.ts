export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

const ALLOWED = [TareeqAdminRole.SUPER_ADMIN, TareeqAdminRole.MODERATOR];

// GET /api/tareeq-admin/posts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin(request, ALLOWED);
  } catch (e) {
    return e as Response;
  }

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

  return Response.json({ ok: true, post });
}

// PATCH /api/tareeq-admin/posts/[id]
// Body: { action: 'hide', reason? } | { action: 'unhide' } | { action: 'delete' }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let admin;
  try {
    admin = await requireAdmin(request, ALLOWED);
  } catch (e) {
    return e as Response;
  }

  const body = await request.json().catch(() => ({}));
  const { action, reason } = body as { action?: string; reason?: string };

  if (!action || !['hide', 'unhide', 'delete'].includes(action)) {
    return Response.json({ error: 'Invalid action — must be hide, unhide, or delete' }, { status: 400 });
  }

  const existing = await prisma.tareeqPost.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: 'Post not found' }, { status: 404 });

  const ip = request.headers.get('x-forwarded-for') ?? undefined;

  if (action === 'delete') {
    await prisma.tareeqPost.delete({ where: { id: params.id } });
    await logAudit(admin.id, 'post.delete', {
      targetType: 'post',
      targetId: params.id,
      details: { postId: params.id },
      ip,
    });
    return Response.json({ ok: true });
  }

  if (action === 'hide') {
    const post = await prisma.tareeqPost.update({
      where: { id: params.id },
      data: { isHidden: true, hiddenBy: admin.id, hiddenReason: reason ?? null },
    });
    await logAudit(admin.id, 'post.hide', {
      targetType: 'post',
      targetId: params.id,
      details: { postId: params.id, reason },
      ip,
    });
    return Response.json({ ok: true, post });
  }

  // unhide
  const post = await prisma.tareeqPost.update({
    where: { id: params.id },
    data: { isHidden: false, hiddenBy: null, hiddenReason: null },
  });
  await logAudit(admin.id, 'post.unhide', {
    targetType: 'post',
    targetId: params.id,
    details: { postId: params.id },
    ip,
  });
  return Response.json({ ok: true, post });
}
