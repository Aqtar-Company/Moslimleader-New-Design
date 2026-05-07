export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createPayPalOrder } from '@/lib/paypal';
import { egpToUsd } from '@/lib/currency';

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

    // Pricing rule: international/PayPal must always prefer the manually
    // stored USD price over a derived EGP→USD conversion. The EGP price is
    // subsidized for Egypt and is not a valid international price.
    //   1. seriesPriceUSD (manual bundle price, if set) wins.
    //   2. Otherwise sum each book's stored priceUSD; books missing a USD
    //      price fall back to egpToUsd(book.price) individually.
    // The previous middle branch — egpToUsd(series.seriesPrice) — was a
    // pricing bug: it ignored each book's correct USD price whenever the
    // series-level seriesPriceUSD happened to be unset.
    let priceUsd: number;
    if (series.seriesPriceUSD && series.seriesPriceUSD > 0) {
      priceUsd = Number(series.seriesPriceUSD);
    } else {
      priceUsd = series.books.reduce((sum, b) => {
        const bookUsd = b.priceUSD && b.priceUSD > 0 ? Number(b.priceUSD) : egpToUsd(Number(b.price));
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
