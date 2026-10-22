export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { isMediaKind } from '@/lib/free-media-shared';

/** Create a category — a shelf inside ONE kind (audio / video / image / pdf). */
export async function POST(req: NextRequest) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const nameEn = typeof body.nameEn === 'string' ? body.nameEn.trim().slice(0, 80) : '';
  if (!name) return NextResponse.json({ error: 'اسم التصنيف مطلوب' }, { status: 400 });
  if (!isMediaKind(body.kind)) return NextResponse.json({ error: 'نوع غير صالح' }, { status: 400 });
  const last = await prisma.freeMediaCategory.findFirst({ where: { kind: body.kind }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
  const category = await prisma.freeMediaCategory.create({
    data: { kind: body.kind, name, nameEn: nameEn || null, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json({ category });
}
