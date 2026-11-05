export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { requirePerm } from '@/lib/permissions';

/**
 * DELETE — the writer, or staff who manage the media library.
 *
 * Two kinds of id: a number is a legacy FreeMediaComment (an item not yet bridged to
 * طريق); anything else is a طريق comment, accepted here only when it sits on a media
 * item's discussion post — this route must not become a way to delete any طريق comment.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { commentId: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const raw = params.commentId;

  if (/^\d+$/.test(raw)) {
    const id = Number(raw);
    const c = await prisma.freeMediaComment.findUnique({ where: { id }, select: { userId: true } });
    if (!c) return NextResponse.json({ ok: true });
    if (c.userId !== user.userId) {
      const guard = await requirePerm(['free-media.write', 'books.write']);
      if ('response' in guard) return guard.response;
    }
    await prisma.freeMediaComment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  const c = await prisma.tareeqComment.findUnique({
    where: { id: raw },
    select: { id: true, userId: true, postId: true, parentId: true, post: { select: { discussionOf: { select: { id: true } } } } },
  });
  if (!c) return NextResponse.json({ ok: true });
  if (!c.post.discussionOf) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (c.userId !== user.userId) {
    const guard = await requirePerm(['free-media.write', 'books.write']);
    if ('response' in guard) return guard.response;
  }
  // طريق's counter counts top-level comments only (see its own delete route).
  await prisma.$transaction([
    prisma.tareeqComment.delete({ where: { id: c.id } }),
    ...(!c.parentId
      ? [prisma.$executeRaw`UPDATE \`TareeqPost\` SET commentCount = GREATEST(0, commentCount - 1) WHERE id = ${c.postId}`]
      : []),
  ]);
  return NextResponse.json({ ok: true });
}
