export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

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

    if (!book.isPublished && (!auth || auth.role !== 'admin')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // Determine access level
    let hasFullAccess = auth?.role === 'admin';
    if (auth && !hasFullAccess) {
      const access = await prisma.bookAccess.findUnique({
        where: { userId_bookId: { userId: auth.userId, bookId: id } },
      });
      hasFullAccess = !!access;
    }

    const filePath = path.join(process.cwd(), 'private', 'books', book.filePath);

    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      return NextResponse.json({ error: 'ملف الكتاب غير متوفر' }, { status: 404 });
    }

    // Full access — send complete PDF
    if (hasFullAccess) {
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          'X-Free-Pages': String(book.freePages),
          'X-Has-Access': 'true',
          'Cache-Control': 'private, no-store',
        },
      });
    }

    // No full access — truncate to freePages server-side
    // This prevents downloading the full PDF via DevTools / direct URL
    const allowed = Math.max(book.freePages, 0);

    if (allowed === 0) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();
    const pagesToKeep = Math.min(allowed, totalPages);

    // Remove all pages beyond the allowed count
    for (let i = totalPages - 1; i >= pagesToKeep; i--) {
      pdfDoc.removePage(i);
    }

    const truncated = Buffer.from(await pdfDoc.save());

    return new NextResponse(truncated, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'X-Free-Pages': String(book.freePages),
        'X-Has-Access': 'false',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[books/:id/file GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
