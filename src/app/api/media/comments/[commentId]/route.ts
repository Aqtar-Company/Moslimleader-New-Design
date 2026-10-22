export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { requirePerm } from '@/lib/permissions';

/** DELETE — the writer, or staff who manage the media library. */
export async function DELETE(_req: NextRequest, { params }: { params: { commentId: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const id = Number(params.commentId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const c = await prisma.freeMediaComment.findUnique({ where: { id }, select: { userId: true } });
  if (!c) return NextResponse.json({ ok: true });
  if (c.userId !== user.userId) {
    const guard = await requirePerm(['free-media.write', 'books.write']);
    if ('response' in guard) return guard.response;
  }
  await prisma.freeMediaComment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
