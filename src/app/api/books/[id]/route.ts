export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/books/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser();

    const book = await prisma.book.findUnique({
      where: { id },
      select: {
        id: true, title: true, titleEn: true, description: true, descriptionEn: true,
        cover: true, author: true, category: true,
        price: true, priceUSD: true, freePages: true, totalPages: true,
        language: true, section: true,
        minAge: true, maxAge: true, needsParentalGuide: true,
        isPublished: true, allowQuoteShare: true, allowFriendShare: true,
        friendShareHours: true, enableReferral: true, referralDiscount: true,
        enableWatermark: true, enableForensic: true,
        _count: { select: { accesses: true } },
      },
    });

    if (!book || (!book.isPublished && (!auth || auth.role !== 'admin'))) {
      return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });
    }

    // Check if current user has access
    let hasAccess = false;
    if (auth) {
      const access = await prisma.bookAccess.findUnique({
        where: { userId_bookId: { userId: auth.userId, bookId: id } },
      });
      hasAccess = !!access;
    }

    return NextResponse.json({ book, hasAccess });
  } catch (err) {
    console.error('[books/:id GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
