export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

const ALLOWED = [TareeqAdminRole.SUPER_ADMIN, TareeqAdminRole.MODERATOR];

// PATCH /api/tareeq-admin/comments/[id]
// Body: { action: 'hide' | 'unhide' | 'delete' }
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
  const { action } = body as { action?: string };

  if (!action || !['hide', 'unhide', 'delete'].includes(action)) {
    return Response.json({ error: 'Invalid action' }, { status: 400 });
  }

  const existing = await prisma.tareeqComment.findUnique({
    where: { id: params.id },
    select: { id: true, postId: true, parentId: true },
  });
  if (!existing) return Response.json({ error: 'Comment not found' }, { status: 404 });

  const ip = request.headers.get('x-forwarded-for') ?? undefined;

  if (action === 'delete') {
    // Only top-level comments are counted (see the comments POST handler), so only those
    // may decrement. Deleting a REPLY here used to decrement all the same, which drives
    // commentCount below zero on any post whose replies a moderator has cleaned up — and
    // the feed then renders a negative comment count.
    await prisma.$transaction([
      prisma.tareeqComment.delete({ where: { id: params.id } }),
      ...(!existing.parentId
        ? [prisma.tareeqPost.update({
            where: { id: existing.postId },
            data: { commentCount: { decrement: 1 } },
          })]
        : []),
    ]);
    await logAudit(admin.id, 'comment.delete', {
      targetType: 'comment',
      targetId: params.id,
      details: { commentId: params.id, postId: existing.postId },
      ip,
    });
    return Response.json({ ok: true });
  }

  if (action === 'hide') {
    await prisma.tareeqComment.update({
      where: { id: params.id },
      data: { isHidden: true, hiddenBy: admin.id },
    });
    await logAudit(admin.id, 'comment.hide', {
      targetType: 'comment',
      targetId: params.id,
      details: { commentId: params.id, postId: existing.postId },
      ip,
    });
    return Response.json({ ok: true });
  }

  // unhide
  await prisma.tareeqComment.update({
    where: { id: params.id },
    data: { isHidden: false, hiddenBy: null },
  });
  await logAudit(admin.id, 'comment.unhide', {
    targetType: 'comment',
    targetId: params.id,
    details: { commentId: params.id, postId: existing.postId },
    ip,
  });
  return Response.json({ ok: true });
}
