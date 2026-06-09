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
      select: {
        name: true, isPublished: true, seriesPrice: true, seriesPriceUSD: true,
        books: {
          where: { isPublished: true },
          select: { id: true, title: true, price: true, priceUSD: true },
        },
      },
    });

    if (!series || !series.isPublished || series.books.length === 0) {
      return NextResponse.json({ error: 'السلسلة غير متاحة' }, { status: 404 });
    }

    // Detect country from reverse-proxy headers (same logic as /api/geo)
    const countryCode = (
      req.headers.get('cf-ipcountry') ||
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('x-country-code') ||
      req.headers.get('x-geoip-country') ||
      ''
    ).toUpperCase();
    const isEgypt = countryCode === 'EG';

    // Egyptian users get the subsidised EGP price converted to USD.
    // International users get the explicit USD price.
    //   1. seriesPriceUSD / seriesPrice: manual bundle price wins if set.
    //   2. Otherwise sum each book's price by zone.
    let priceUsd: number;
    if (isEgypt) {
      const egpTotal = series.seriesPrice && series.seriesPrice > 0
        ? Number(series.seriesPrice)
        : series.books.reduce((sum, b) => sum + Number(b.price), 0);
      priceUsd = egpToUsd(egpTotal);
    } else if (series.seriesPriceUSD && series.seriesPriceUSD > 0) {
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

    // Store expected amount so capture can verify without recalculating
    await prisma.setting.upsert({
      where: { key: `pp_pending_${paypalOrder.id}` },
      create: { key: `pp_pending_${paypalOrder.id}`, value: { expectedUsd: finalUsd, userId: auth.userId, createdAt: Date.now() } },
      update: { value: { expectedUsd: finalUsd, userId: auth.userId, createdAt: Date.now() } },
    });

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
