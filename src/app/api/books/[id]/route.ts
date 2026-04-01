export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/books/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const baseSelect = {
    id: true, title: true, titleEn: true, description: true, descriptionEn: true,
    cover: true, author: true, category: true,
    price: true, priceUSD: true, freePages: true, totalPages: true,
    language: true, section: true,
    isPublished: true, allowQuoteShare: true, allowFriendShare: true,
    friendShareHours: true, enableReferral: true, referralDiscount: true,
    enableWatermark: true, enableForensic: true,
    paperProductSlug: true,
    _count: { select: { accesses: true } },
  };

  try {
    const { id } = await params;
    const auth = await getAuthUser();

    let book;
    try {
      book = await prisma.book.findUnique({
        where: { id },
        select: { ...baseSelect, minAge: true, maxAge: true, needsParentalGuide: true },
      });
    } catch {
      // Fallback if age columns don't exist yet
      book = await prisma.book.findUnique({ where: { id }, select: baseSelect });
    }

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

    // buyCount = number of paid accesses
    const buyCount = (book as any)._count?.accesses ?? 0;

    // viewCount = number of unique visitors (from BookAccessLog)
    let viewCount = buyCount;
    try {
      viewCount = await prisma.bookAccessLog.count({ where: { bookId: id } });
    } catch {
      // fallback to buyCount if table doesn't exist yet
    }

    return NextResponse.json({ book, hasAccess, viewCount, buyCount });
  } catch (err) {
    console.error('[books/:id GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
