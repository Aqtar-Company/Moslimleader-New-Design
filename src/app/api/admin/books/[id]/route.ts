export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// PUT /api/admin/books/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePerm('books.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const { id } = await params;
    const body = await req.json();

    const ALLOWED = [
      'title', 'titleEn', 'description', 'descriptionEn', 'author', 'authorEn',
      'cover', 'price', 'priceUSD', 'freePages', 'totalPages', 'isPublished',
      'language', 'filePath', 'seriesId', 'seriesOrder',
      'minAge', 'maxAge', 'needsParentalGuide',
    ];
    const data: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ALLOWED) if (k in body) data[k] = body[k];

    const book = await prisma.book.update({ where: { id }, data });

    await logActionSafe({
      actor: auth,
      action: 'book.update',
      entity: 'Book',
      entityId: id,
      metadata: { fields: Object.keys(data).filter(k => k !== 'updatedAt'), title: book.title },
    });

    return NextResponse.json({ book });
  } catch (err) {
    console.error('[admin books PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE /api/admin/books/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePerm('books.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const { id } = await params;
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });

    // Delete PDF file if exists
    if (book.filePath) {
      try {
        await unlink(path.join(process.cwd(), 'private', 'books', book.filePath));
      } catch { /* file may not exist */ }
    }

    await prisma.book.delete({ where: { id } });
    await logActionSafe({
      actor: auth,
      action: 'book.delete',
      entity: 'Book',
      entityId: id,
      before: { title: book.title },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin books DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
