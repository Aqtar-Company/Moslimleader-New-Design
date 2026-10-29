export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { capturePayPalOrder, PayPalCaptureError } from '@/lib/paypal';
import { sendOrderEmails } from '@/lib/order-email';
import { egpToUsd } from '@/lib/currency';
import { booksForLang, normalizeSeriesLang, seriesLangPrice } from '@/lib/series-lang';

// POST /api/series/[id]/paypal-capture — capture PayPal payment, grant access to the books of the
// language that was bought (decided in paypal-create and stored on the pending Setting).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const { id: seriesId } = await params;
    const body = await req.json();
    const paypalOrderId = String(body?.paypalOrderId || '');

    if (!paypalOrderId) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    // Idempotency — check if already processed
    const existingOrder = await prisma.bookOrder.findUnique({ where: { paypalOrderId } });
    if (existingOrder) {
      return NextResponse.json({ orderId: existingOrder.id, status: existingOrder.status });
    }

    // Fetch series + published books
    const series = await prisma.bookSeries.findUnique({
      where: { id: seriesId },
      include: {
        books: {
          where: { isPublished: true },
          select: { id: true, title: true, price: true, priceUSD: true, cover: true, language: true },
        },
      },
    });

    // Read expected amount + language from Setting (stored by paypal-create) — never recalculate
    const pendingSetting = await prisma.setting.findUnique({ where: { key: `pp_pending_${paypalOrderId}` } });
    const pendingValue = (pendingSetting?.value ?? null) as Record<string, unknown> | null;
    const storedExpected = pendingValue ? Number(pendingValue.expectedUsd ?? 0) : null;
    // The language is the one the order was CREATED for. The body value is only a
    // fallback for a lost Setting — it can never widen what was paid for, because the
    // amount check below is against the same language's price.
    // The order must belong to THIS buyer and THIS series — otherwise a cheap series' paid
    // order could be redeemed against an expensive one.
    if (pendingValue) {
      if (pendingValue.userId && pendingValue.userId !== auth.userId) {
        return NextResponse.json({ error: 'طلب الدفع لا يخص هذا الحساب' }, { status: 403 });
      }
      if (pendingValue.seriesId && pendingValue.seriesId !== seriesId) {
        return NextResponse.json({ error: 'طلب الدفع لا يخص هذه السلسلة' }, { status: 400 });
      }
    }
    const lang = normalizeSeriesLang(
      typeof pendingValue?.lang === 'string' ? (pendingValue.lang as string)
        : typeof body?.lang === 'string' ? body.lang : null,
    );

    const langBooks = series ? booksForLang(series.books, lang) : [];
    if (!series || !series.isPublished || langBooks.length === 0) {
      return NextResponse.json({ error: 'السلسلة غير متاحة' }, { status: 404 });
    }

    // Fallback if Setting was lost (same per-language price as paypal-create)
    const fallbackLangPrice = seriesLangPrice(series, series.books, lang);
    const fallbackUsd = series.seriesPriceUSD && series.seriesPriceUSD > 0
      ? fallbackLangPrice.usd
      : series.seriesPrice && series.seriesPrice > 0
        ? egpToUsd(fallbackLangPrice.egp)
        : fallbackLangPrice.usd;
    const expectedRounded = Math.max(0.01, Math.round((storedExpected ?? fallbackUsd) * 100) / 100);

    // Capture PayPal payment
    const captureResult = await capturePayPalOrder(paypalOrderId);
    if (captureResult.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'الدفع لم يكتمل', paypalStatus: captureResult.status }, { status: 400 });
    }

    // Verify amount + currency
    const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount = Number(capture?.amount?.value || 0);
    const capturedCurrency = capture?.amount?.currency_code;
    if (capturedCurrency !== 'USD') {
      console.error('[series paypal-capture] currency mismatch', { paypalOrderId });
      return NextResponse.json({ error: 'خطأ في عملة الدفع' }, { status: 400 });
    }
    if (Math.abs(capturedAmount - expectedRounded) > 0.01) {
      console.error('[series paypal-capture] amount mismatch', { expected: expectedRounded, captured: capturedAmount, paypalOrderId });
      return NextResponse.json({ error: 'المبلغ المدفوع لا يطابق المطلوب' }, { status: 400 });
    }

    const masterOrderId = `SR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Atomic: create BookOrder records for each book + grant BookAccess for each
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < langBooks.length; i++) {
        const book = langBooks[i];
        const isFirst = i === 0;

        // Skip if user already has access (e.g. bought one book earlier)
        const existingAccess = await tx.bookAccess.findUnique({
          where: { userId_bookId: { userId: auth.userId, bookId: book.id } },
        });

        if (!existingAccess) {
          await tx.bookAccess.create({
            data: {
              userId: auth.userId,
              bookId: book.id,
              lastPage: 1,
            },
          });
        }

        // Create BookOrder for each book; only first one gets the PayPal order ID (for idempotency)
        await tx.bookOrder.create({
          data: {
            id: `${masterOrderId}-${i + 1}`,
            userId: auth.userId,
            bookId: book.id,
            status: 'paid',
            price: isFirst ? expectedRounded : 0,
            currency: 'USD',
            paymentMethod: 'paypal',
            paypalOrderId: isFirst ? paypalOrderId : null,
          },
        });
      }
    });

    // Send notification email
    try {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { name: true, email: true, phone: true },
      });
      await sendOrderEmails({
        orderId: masterOrderId,
        orderNumber: masterOrderId,
        items: langBooks.map((b, i) => ({
          productName: `📚 ${i + 1}. ${b.title}`,
          productImage: b.cover,
          quantity: 1,
          unitPrice: i === 0 ? expectedRounded : 0,
        })),
        subtotal: expectedRounded,
        discount: 0,
        couponCode: null,
        shippingCost: 0,
        total: expectedRounded,
        currency: 'USD',
        paymentMethod: 'paypal',
        customerName: user?.name || 'ضيف',
        customerEmail: user?.email || '—',
        customerPhone: user?.phone || '—',
        shippingAddress: { country: `سلسلة رقمية (${langBooks.length} كتب) - وصول فوري` },
        notes: null,
      });
    } catch (emailErr) {
      console.error('[series paypal-capture email]', emailErr);
    }

    // Cleanup pending Setting (best-effort)
    prisma.setting.delete({ where: { key: `pp_pending_${paypalOrderId}` } }).catch(() => {});

    return NextResponse.json({ orderId: masterOrderId, status: 'paid', granted: langBooks.length, lang });
  } catch (err) {
    if (err instanceof PayPalCaptureError) {
      console.error('[series paypal-capture] paypal rejected', {
        status: err.status, issue: err.issue, description: err.description, debugId: err.debugId,
      });
      const friendlyByIssue: Record<string, string> = {
        COMPLIANCE_VIOLATION: 'فشلت المعاملة لدى PayPal بسبب قيد على حساب التاجر. لم يتم خصم أي مبلغ. برجاء المحاولة بطريقة دفع أخرى أو التواصل مع الدعم.',
        INSTRUMENT_DECLINED: 'البطاقة مرفوضة من البنك أو PayPal. جرّب بطاقة أخرى أو تواصل مع البنك.',
        PAYER_ACCOUNT_RESTRICTED: 'حساب المشتري على PayPal مقيَّد. حاول طريقة دفع أخرى.',
        PAYEE_ACCOUNT_RESTRICTED: 'حساب التاجر مقيَّد حالياً — تواصل مع الدعم.',
        TRANSACTION_REFUSED: 'تم رفض المعاملة من PayPal. جرّب بطاقة أخرى أو طريقة دفع بديلة.',
      };
      const friendly = err.issue && friendlyByIssue[err.issue]
        ? friendlyByIssue[err.issue]
        : 'تعذّر إتمام الدفع لدى PayPal. لم يتم خصم أي مبلغ. حاول طريقة دفع أخرى.';
      return NextResponse.json({
        error: friendly,
        detail: err.description ?? err.issue ?? 'PayPal rejected',
        paypalIssue: err.issue,
        paypalDebugId: err.debugId,
      }, { status: 400 });
    }
    console.error('[series paypal-capture]', err);
    return NextResponse.json({ error: 'حدث خطأ في تأكيد الدفع' }, { status: 500 });
  }
}
