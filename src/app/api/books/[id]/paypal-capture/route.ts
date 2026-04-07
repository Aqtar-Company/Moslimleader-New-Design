export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { capturePayPalOrder } from '@/lib/paypal';
import { sendOrderEmails } from '@/lib/order-email';

// POST /api/books/[id]/paypal-capture — capture PayPal payment, create BookOrder, grant access
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const { id: bookId } = await params;
    const body = await req.json();
    const paypalOrderId = String(body?.paypalOrderId || '');

    if (!paypalOrderId) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    // Idempotency — check if we already processed this PayPal order
    const existingOrder = await prisma.bookOrder.findUnique({ where: { paypalOrderId } });
    if (existingOrder) {
      return NextResponse.json({ orderId: existingOrder.id, status: existingOrder.status });
    }

    // Check if user already has access (shouldn't happen if create-order checked)
    const existingAccess = await prisma.bookAccess.findUnique({
      where: { userId_bookId: { userId: auth.userId, bookId } },
    });
    if (existingAccess) {
      return NextResponse.json({ error: 'لديك وصول بالفعل لهذا الكتاب' }, { status: 400 });
    }

    // Fetch the book to recalculate expected price
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, title: true, price: true, priceUSD: true, cover: true, author: true },
    });
    if (!book) {
      return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });
    }

    const expectedUsd = book.priceUSD && book.priceUSD > 0
      ? Number(book.priceUSD)
      : Number(book.price) * 0.10;
    const expectedRounded = Math.max(0.01, Math.round(expectedUsd * 100) / 100);

    // Capture PayPal payment
    const captureResult = await capturePayPalOrder(paypalOrderId);
    if (captureResult.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'الدفع لم يكتمل', paypalStatus: captureResult.status }, { status: 400 });
    }

    // Verify amount + currency (anti-tampering)
    const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount = Number(capture?.amount?.value || 0);
    const capturedCurrency = capture?.amount?.currency_code;
    if (capturedCurrency !== 'USD') {
      console.error('[books paypal-capture] currency mismatch', { expected: 'USD', got: capturedCurrency, paypalOrderId });
      return NextResponse.json({ error: 'خطأ في عملة الدفع' }, { status: 400 });
    }
    if (Math.abs(capturedAmount - expectedRounded) > 0.01) {
      console.error('[books paypal-capture] amount mismatch', { expected: expectedRounded, captured: capturedAmount, paypalOrderId });
      return NextResponse.json({ error: 'المبلغ المدفوع لا يطابق المطلوب' }, { status: 400 });
    }

    const bookOrderId = `BK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Atomic: create BookOrder + grant BookAccess
    await prisma.$transaction(async (tx) => {
      await tx.bookOrder.create({
        data: {
          id: bookOrderId,
          userId: auth.userId,
          bookId,
          status: 'paid',
          price: expectedRounded,
          currency: 'USD',
          paymentMethod: 'paypal',
          paypalOrderId,
        },
      });
      await tx.bookAccess.create({
        data: {
          userId: auth.userId,
          bookId,
          lastPage: 1,
        },
      });
    });

    // Send notification email to admin + customer (non-blocking)
    try {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { name: true, email: true, phone: true },
      });
      await sendOrderEmails({
        orderId: bookOrderId,
        orderNumber: bookOrderId,
        items: [{
          productName: `📚 ${book.title}${book.author ? ` — ${book.author}` : ''}`,
          productImage: book.cover,
          quantity: 1,
          unitPrice: expectedRounded,
        }],
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
        shippingAddress: { country: 'كتاب رقمي - وصول فوري' },
        notes: null,
      });
    } catch (emailErr) {
      console.error('[books paypal-capture email]', emailErr);
    }

    return NextResponse.json({ orderId: bookOrderId, status: 'paid', granted: true });
  } catch (err) {
    console.error('[books paypal-capture]', err);
    return NextResponse.json({ error: 'حدث خطأ في تأكيد الدفع' }, { status: 500 });
  }
}
