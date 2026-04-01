export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/series — public list of all series with their books
export async function GET() {
  try {
    const series = await prisma.bookSeries.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'asc' },
      include: {
        books: {
          where: { isPublished: true },
          select: {
            id: true,
            title: true,
            titleEn: true,
            cover: true,
            price: true,
            priceUSD: true,
            seriesOrder: true,
            language: true,
            freePages: true,
            totalPages: true,
            author: true,
            authorEn: true,
          },
          orderBy: { seriesOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({ series });
  } catch (err) {
    console.error('[public series GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
