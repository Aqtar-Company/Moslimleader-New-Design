export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createPayPalOrder } from '@/lib/paypal';
import { egpToUsd } from '@/lib/currency';
import { booksForLang, normalizeSeriesLang, seriesLangPrice } from '@/lib/series-lang';

// POST /api/series/[id]/paypal-create — create a PayPal order for a series IN ONE LANGUAGE.
// Body: { lang } — the language edition being bought. Only that language's books are
// priced, and paypal-capture grants only those (see src/lib/series-lang.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const { id: seriesId } = await params;
    let bodyLang: unknown;
    try { bodyLang = (await req.json())?.lang; } catch { /* no body */ }
    const lang = normalizeSeriesLang(typeof bodyLang === 'string' ? bodyLang : null);

    // Fetch series with its books (server-side, never trust client)
    const series = await prisma.bookSeries.findUnique({
      where: { id: seriesId },
      select: {
        name: true, isPublished: true, seriesPrice: true, seriesPriceUSD: true, plannedBookCount: true,
        books: {
          where: { isPublished: true },
          select: { id: true, title: true, price: true, priceUSD: true, language: true },
        },
      },
    });

    const langBooks = series ? booksForLang(series.books, lang) : [];
    if (!series || !series.isPublished || langBooks.length === 0) {
      return NextResponse.json({ error: 'السلسلة غير متاحة' }, { status: 404 });
    }

    // Nothing to sell if the buyer already owns every book of this language edition.
    const owned = await prisma.bookAccess.count({
      where: { userId: auth.userId, bookId: { in: langBooks.map(b => b.id) } },
    });
    if (owned >= langBooks.length) {
      return NextResponse.json({ error: 'لديك بالفعل كل كتب هذه السلسلة بهذه اللغة' }, { status: 400 });
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

    // The price of ONE language's share of the series — the same function the
    // product page and the buy page use, so shown price == charged price.
    // Egyptian users get the subsidised EGP price converted to USD.
    const langPrice = seriesLangPrice(series, series.books, lang);
    const priceUsd = isEgypt ? egpToUsd(langPrice.egp) : langPrice.usd;

    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return NextResponse.json({ error: 'خطأ في سعر السلسلة' }, { status: 400 });
    }

    const finalUsd = Math.max(0.01, Math.round(priceUsd * 100) / 100);
    // Exactly the books being paid for NOW — books uploaded while the buyer is at PayPal
    // must not ride along for a price computed without them.
    const bookIds = langBooks.map(b => b.id);
    const referenceId = `series-${seriesId}-${lang}-${auth.userId}-${Date.now()}`;

    const paypalOrder = await createPayPalOrder(finalUsd, 'USD', referenceId);

    // Store expected amount so capture can verify without recalculating
    await prisma.setting.upsert({
      where: { key: `pp_pending_${paypalOrder.id}` },
      create: { key: `pp_pending_${paypalOrder.id}`, value: { expectedUsd: finalUsd, userId: auth.userId, seriesId, lang, bookIds, createdAt: Date.now() } },
      update: { value: { expectedUsd: finalUsd, userId: auth.userId, seriesId, lang, bookIds, createdAt: Date.now() } },
    });

    return NextResponse.json({
      paypalOrderId: paypalOrder.id,
      expectedAmountUsd: finalUsd,
      seriesName: series.name,
      bookCount: langBooks.length,
      lang,
    });
  } catch (err) {
    console.error('[series paypal-create]', err);
    return NextResponse.json({ error: 'حدث خطأ في إنشاء طلب الدفع' }, { status: 500 });
  }
}
