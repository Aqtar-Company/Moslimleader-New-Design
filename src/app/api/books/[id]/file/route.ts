export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import path from 'path';

// GET /api/books/[id]/file — serve PDF (requires auth + checks access for full file)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser();

    const book = await prisma.book.findUnique({
      where: { id },
      select: { filePath: true, isPublished: true, freePages: true },
    });

    if (!book || !book.filePath) {
      return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });
    }

    // Only published books or admin
    if (!book.isPublished && (!auth || auth.role !== 'admin')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // Check if user has full access
    let hasFullAccess = auth?.role === 'admin';
    if (auth && !hasFullAccess) {
      const access = await prisma.bookAccess.findUnique({
        where: { userId_bookId: { userId: auth.userId, bookId: id } },
      });
      hasFullAccess = !!access;
    }

    const filePath = path.join(process.cwd(), 'private', 'books', book.filePath);

    try {
      const buffer = await readFile(filePath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          // Tell client how many free pages allowed if no full access
          'X-Free-Pages': String(book.freePages),
          'X-Has-Access': String(hasFullAccess),
          'Cache-Control': 'private, no-store',
        },
      });
    } catch {
      return NextResponse.json({ error: 'ملف الكتاب غير متوفر' }, { status: 404 });
    }
  } catch (err) {
    console.error('[books/:id/file GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
