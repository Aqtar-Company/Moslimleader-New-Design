export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { getPdfPageCount } from '@/lib/pdf-renderer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: bookId } = await params;
    const auth = await getAuthUser();

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { filePath: true, isPublished: true },
    });

    if (!book || !book.filePath) {
      return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });
    }

    if (!book.isPublished && (!auth || auth.role !== 'admin')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const total = await getPdfPageCount(bookId, book.filePath);
    return NextResponse.json({ total }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch (err) {
    console.error('[books/:id/pages GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
