export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { R2_PUBLIC_URL } from '@/lib/r2';
import { LOGO_R2_PREFIX } from '@/lib/logo-designs';

const ours = (u: unknown): u is string => typeof u === 'string' && !!R2_PUBLIC_URL && u.startsWith(`${R2_PUBLIC_URL}/${LOGO_R2_PREFIX}`);

/** GET: every design, published or not. POST: create one from an uploaded file. */
export async function GET() {
  const guard = await requirePerm(['free-media.read', 'free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const designs = await prisma.logoDesign.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }] });
  return NextResponse.json({ designs });
}

export async function POST(req: NextRequest) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const b = await req.json().catch(() => ({}));
  const title = String(b.title ?? '').trim().slice(0, 190);
  if (!title) return NextResponse.json({ error: 'اكتب اسم التصميم' }, { status: 400 });
  if (!ours(b.fileUrl)) return NextResponse.json({ error: 'ارفع ملف التصميم أولاً' }, { status: 400 });
  if (!['png', 'jpg', 'svg', 'pdf'].includes(b.fileType)) return NextResponse.json({ error: 'نوع الملف غير معروف' }, { status: 400 });
  if (b.fileType === 'pdf' && !ours(b.previewUrl)) return NextResponse.json({ error: 'ملف PDF يحتاج صورة معاينة' }, { status: 400 });
  // New designs go first.
  const first = await prisma.logoDesign.findFirst({ orderBy: { sortOrder: 'asc' }, select: { sortOrder: true } });
  const design = await prisma.logoDesign.create({
    data: {
      title,
      note: String(b.note ?? '').trim().slice(0, 2000) || null,
      fileUrl: b.fileUrl,
      fileType: b.fileType,
      fileSize: Math.max(0, Math.floor(Number(b.fileSize) || 0)),
      width: Number.isFinite(b.width) ? Math.floor(b.width) : null,
      height: Number.isFinite(b.height) ? Math.floor(b.height) : null,
      previewUrl: ours(b.previewUrl) ? b.previewUrl : null,
      isPublished: b.isPublished !== false,
      sortOrder: (first?.sortOrder ?? 0) - 1,
    },
  });
  return NextResponse.json({ design });
}
