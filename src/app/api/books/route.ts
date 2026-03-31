export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/books — public list of published books
export async function GET() {
  try {
    const books = await prisma.book.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, titleEn: true, cover: true,
        description: true, author: true, category: true,
        price: true, priceUSD: true, freePages: true, totalPages: true,
        language: true, section: true,
        allowFriendShare: true, enableReferral: true,
        _count: { select: { accesses: true } },
      },
    });
    return NextResponse.json({ books });
  } catch (err) {
    console.error('[books GET]', err);
    return NextResponse.json({ books: [] }, { status: 500 });
  }
}
