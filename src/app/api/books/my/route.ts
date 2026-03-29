export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/books/my — return books the current user has access to
export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const accesses = await prisma.bookAccess.findMany({
      where: { userId: auth.userId },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            cover: true,
            author: true,
            totalPages: true,
          },
        },
      },
      orderBy: { grantedAt: 'desc' },
    });

    const books = accesses.map(a => ({
      id: a.book.id,
      title: a.book.title,
      cover: a.book.cover,
      author: a.book.author,
      totalPages: a.book.totalPages,
      lastPage: a.lastPage,
      grantedAt: a.grantedAt,
    }));

    return NextResponse.json({ books });
  } catch (err) {
    console.error('[books/my GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
