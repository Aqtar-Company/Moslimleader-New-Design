export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

/** Rename or reorder. The kind never changes: the items under it are of that kind. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; nameEn?: string | null; sortOrder?: number } = {};
  if (typeof body.name === 'string') {
    const n = body.name.trim().slice(0, 80);
    if (!n) return NextResponse.json({ error: 'اسم التصنيف مطلوب' }, { status: 400 });
    data.name = n;
  }
  if (typeof body.nameEn === 'string') data.nameEn = body.nameEn.trim().slice(0, 80) || null;
  if (Number.isFinite(Number(body.sortOrder))) data.sortOrder = Math.trunc(Number(body.sortOrder));
  try {
    const category = await prisma.freeMediaCategory.update({ where: { id }, data });
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  }
}

/** Delete a shelf. Its items stay, uncategorised (`onDelete: SetNull` in the schema). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 });
  await prisma.freeMediaCategory.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
