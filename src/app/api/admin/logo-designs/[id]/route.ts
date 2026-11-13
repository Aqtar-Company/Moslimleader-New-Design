export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { R2_PUBLIC_URL } from '@/lib/r2';
import { LOGO_R2_PREFIX, removeDesignFiles } from '@/lib/logo-designs';

const ours = (u: unknown): u is string => typeof u === 'string' && !!R2_PUBLIC_URL && u.startsWith(`${R2_PUBLIC_URL}/${LOGO_R2_PREFIX}`);

/** PATCH: title / note / isPublished / sortOrder / previewUrl. DELETE: the row and its files. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const id = parseInt(params.id);
  const existing = await prisma.logoDesign.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.title === 'string') {
    const t = b.title.trim().slice(0, 190);
    if (!t) return NextResponse.json({ error: 'اكتب اسم التصميم' }, { status: 400 });
    data.title = t;
  }
  if (typeof b.note === 'string') data.note = b.note.trim().slice(0, 2000) || null;
  if (typeof b.isPublished === 'boolean') data.isPublished = b.isPublished;
  if (Number.isFinite(b.sortOrder)) data.sortOrder = Math.floor(b.sortOrder);
  if (b.previewUrl !== undefined) {
    if (!ours(b.previewUrl)) return NextResponse.json({ error: 'صورة المعاينة غير صالحة' }, { status: 400 });
    data.previewUrl = b.previewUrl;
  }
  const design = await prisma.logoDesign.update({ where: { id }, data });
  if (data.previewUrl && existing.previewUrl && existing.previewUrl !== existing.fileUrl && existing.previewUrl !== data.previewUrl) {
    void removeDesignFiles([existing.previewUrl]);
  }
  return NextResponse.json({ design });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const id = parseInt(params.id);
  const existing = await prisma.logoDesign.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  await prisma.logoDesign.delete({ where: { id } });
  void removeDesignFiles([existing.fileUrl, existing.previewUrl]);
  return NextResponse.json({ ok: true });
}
