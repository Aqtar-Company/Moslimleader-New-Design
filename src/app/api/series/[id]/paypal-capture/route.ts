export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { capturePayPalOrder } from '@/lib/paypal';
import { sendOrderEmails } from '@/lib/order-email';

// POST /api/series/[id]/paypal-capture — capture PayPal payment, grant access to all books
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
          select: { id: true, title: true, price: true, priceUSD: true, cover: true },
        },
      },
    });

    if (!series || !series.isPublished || series.books.length === 0) {
      return NextResponse.json({ error: 'السلسلة غير متاحة' }, { status: 404 });
    }

    // Recalculate expected USD price
    let expectedUsd: number;
    if (series.seriesPriceUSD && series.seriesPriceUSD > 0) {
      expectedUsd = Number(series.seriesPriceUSD);
    } else if (series.seriesPrice && series.seriesPrice > 0) {
      expectedUsd = Number(series.seriesPrice) * 0.10;
    } else {
      expectedUsd = series.books.reduce((sum, b) => {
        const bookUsd = b.priceUSD && b.priceUSD > 0 ? Number(b.priceUSD) : Number(b.price) * 0.10;
        return sum + bookUsd;
      }, 0);
    }
    const expectedRounded = Math.max(0.01, Math.round(expectedUsd * 100) / 100);

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
      for (let i = 0; i < series.books.length; i++) {
        const book = series.books[i];
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
        items: series.books.map((b, i) => ({
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
        shippingAddress: { country: `سلسلة رقمية (${series.books.length} كتب) - وصول فوري` },
        notes: null,
      });
    } catch (emailErr) {
      console.error('[series paypal-capture email]', emailErr);
    }

    return NextResponse.json({ orderId: masterOrderId, status: 'paid', granted: series.books.length });
  } catch (err) {
    console.error('[series paypal-capture]', err);
    return NextResponse.json({ error: 'حدث خطأ في تأكيد الدفع' }, { status: 500 });
  }
}
