export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createPayPalOrder } from '@/lib/paypal';

// POST /api/series/[id]/paypal-create — create a PayPal order for a full series
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const { id: seriesId } = await params;

    // Fetch series with its books (server-side, never trust client)
    const series = await prisma.bookSeries.findUnique({
      where: { id: seriesId },
      include: {
        books: {
          where: { isPublished: true },
          select: { id: true, title: true, price: true, priceUSD: true },
        },
      },
    });

    if (!series || !series.isPublished || series.books.length === 0) {
      return NextResponse.json({ error: 'السلسلة غير متاحة' }, { status: 404 });
    }

    // Calculate USD price server-side
    // Prefer series-level price if set, otherwise sum of books
    let priceUsd: number;
    if (series.seriesPriceUSD && series.seriesPriceUSD > 0) {
      priceUsd = Number(series.seriesPriceUSD);
    } else if (series.seriesPrice && series.seriesPrice > 0) {
      priceUsd = Number(series.seriesPrice) * 0.10;
    } else {
      // Sum individual book prices in USD
      priceUsd = series.books.reduce((sum, b) => {
        const bookUsd = b.priceUSD && b.priceUSD > 0 ? Number(b.priceUSD) : Number(b.price) * 0.10;
        return sum + bookUsd;
      }, 0);
    }

    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return NextResponse.json({ error: 'خطأ في سعر السلسلة' }, { status: 400 });
    }

    const finalUsd = Math.max(0.01, Math.round(priceUsd * 100) / 100);
    const referenceId = `series-${seriesId}-${auth.userId}-${Date.now()}`;

    const paypalOrder = await createPayPalOrder(finalUsd, 'USD', referenceId);

    return NextResponse.json({
      paypalOrderId: paypalOrder.id,
      expectedAmountUsd: finalUsd,
      seriesName: series.name,
      bookCount: series.books.length,
    });
  } catch (err) {
    console.error('[series paypal-create]', err);
    return NextResponse.json({ error: 'حدث خطأ في إنشاء طلب الدفع' }, { status: 500 });
  }
}
