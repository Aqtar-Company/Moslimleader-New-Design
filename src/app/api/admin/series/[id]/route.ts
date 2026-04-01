export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// GET /api/admin/series/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const { id } = await params;

    const series = await prisma.bookSeries.findUnique({
      where: { id },
      include: {
        books: {
          select: { id: true, title: true, titleEn: true, cover: true, price: true, seriesOrder: true, language: true, isPublished: true },
          orderBy: { seriesOrder: 'asc' },
        },
      },
    });

    if (!series) return NextResponse.json({ error: 'السلسلة غير موجودة' }, { status: 404 });
    return NextResponse.json({ series });
  } catch (err) {
    console.error('[admin series GET id]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// PUT /api/admin/series/[id] — update series info
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const { id } = await params;
    const body = await req.json();

    const series = await prisma.bookSeries.update({
      where: { id },
      data: { ...body, updatedAt: new Date() },
    });

    return NextResponse.json({ series });
  } catch (err) {
    console.error('[admin series PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE /api/admin/series/[id] — delete series (unlinks books, doesn't delete them)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const { id } = await params;

    // Unlink all books from this series first
    await prisma.book.updateMany({
      where: { seriesId: id },
      data: { seriesId: null, seriesOrder: null },
    });

    await prisma.bookSeries.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin series DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
