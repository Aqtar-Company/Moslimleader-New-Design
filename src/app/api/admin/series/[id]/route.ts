export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// GET /api/admin/series/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePerm(['books.read', 'books.write'] as Permission[]);
    if ('response' in guard) return guard.response;
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
    const guard = await requirePerm('books.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;
    const { id } = await params;
    const body = await req.json();

    const ALLOWED = ['title', 'titleEn', 'description', 'descriptionEn', 'cover', 'price', 'priceUSD', 'isPublished'];
    const data: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ALLOWED) if (k in body) data[k] = body[k];

    const series = await prisma.bookSeries.update({ where: { id }, data });

    await logActionSafe({
      actor: auth,
      action: 'series.update',
      entity: 'BookSeries',
      entityId: id,
      metadata: { fields: Object.keys(data).filter(k => k !== 'updatedAt') },
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
    const guard = await requirePerm('books.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;
    const { id } = await params;

    // Unlink all books from this series first
    await prisma.book.updateMany({
      where: { seriesId: id },
      data: { seriesId: null, seriesOrder: null },
    });

    await prisma.bookSeries.delete({ where: { id } });
    await logActionSafe({
      actor: auth,
      action: 'series.delete',
      entity: 'BookSeries',
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin series DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
