export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { renderPdfPage } from '@/lib/pdf-renderer';

type Params = { params: Promise<{ id: string; num: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: bookId, num } = await params;
    const pageNum = parseInt(num, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return NextResponse.json({ error: 'رقم صفحة غير صحيح' }, { status: 400 });
    }

    const auth = await getAuthUser();

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { filePath: true, isPublished: true, freePages: true },
    });

    if (!book || !book.filePath) {
      return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });
    }

    if (!book.isPublished && (!auth || auth.role !== 'admin')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // Determine access level
    let hasFullAccess = auth?.role === 'admin';
    if (auth && !hasFullAccess) {
      const access = await prisma.bookAccess.findUnique({
        where: { userId_bookId: { userId: auth.userId, bookId } },
      });
      hasFullAccess = !!access;
    }

    // Enforce free page limit — deny page requests beyond allowed count
    const allowed = hasFullAccess ? Infinity : book.freePages;
    if (pageNum > allowed) {
      return NextResponse.json({ error: 'غير مصرح — اشترِ الكتاب للوصول الكامل' }, { status: 403 });
    }

    const pngBuffer = await renderPdfPage(bookId, book.filePath, pageNum);

    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        // Private caching: fast for the same user, re-validated if auth changes
        'Cache-Control': 'private, max-age=3600',
        'X-Has-Access': String(hasFullAccess),
        'X-Free-Pages': String(book.freePages),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('out of range')) {
      return NextResponse.json({ error: 'رقم الصفحة خارج النطاق' }, { status: 404 });
    }
    console.error('[books/:id/page/:num GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
