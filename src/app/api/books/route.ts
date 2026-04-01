export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/books — public list of published books
export async function GET() {
  const baseSelect = {
    id: true, title: true, titleEn: true, cover: true,
    description: true, author: true, category: true,
    price: true, priceUSD: true, freePages: true, totalPages: true,
    language: true, section: true, seriesId: true, seriesOrder: true,
    allowFriendShare: true, enableReferral: true,
    _count: { select: { accesses: true } },
  };

  try {
    // Try with age/guidance fields first
    const books = await prisma.book.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      select: {
        ...baseSelect,
        minAge: true, maxAge: true, needsParentalGuide: true,
      },
    });
    return NextResponse.json({ books });
  } catch (err) {
    console.error('[books GET] query with age fields failed, retrying without:', (err as Error).message);
    try {
      // Fallback: query without age fields (migration may not be applied yet)
      const books = await prisma.book.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: 'desc' },
        select: baseSelect,
      });
      return NextResponse.json({ books });
    } catch (err2) {
      console.error('[books GET]', err2);
      return NextResponse.json({ books: [] }, { status: 500 });
    }
  }
}
