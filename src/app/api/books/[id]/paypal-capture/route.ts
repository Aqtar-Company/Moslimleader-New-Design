export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { capturePayPalOrder, PayPalCaptureError } from '@/lib/paypal';
import { sendOrderEmails } from '@/lib/order-email';
import { egpToUsd } from '@/lib/currency';

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

    // Read expected amount from Setting (stored by paypal-create) — never recalculate
    const pendingSetting = await prisma.setting.findUnique({ where: { key: `pp_pending_${paypalOrderId}` } });
    const storedExpected = pendingSetting ? Number((pendingSetting.value as Record<string, unknown>)?.expectedUsd ?? 0) : null;
    // Fallback: use book price if Setting was lost (shouldn't happen in normal flow)
    const fallbackUsd = book.priceUSD && book.priceUSD > 0
      ? Number(book.priceUSD)
      : egpToUsd(Number(book.price));
    const expectedRounded = Math.max(0.01, Math.round((storedExpected ?? fallbackUsd) * 100) / 100);

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
    const referrerToken = String(body?.referrerToken || '').trim() || null;

    // Resolve referrer from BookShareLink token if provided
    let referrerId: string | null = null;
    let referralDiscountPct = 0;
    if (referrerToken) {
      const shareLink = await prisma.bookShareLink.findUnique({
        where: { token: referrerToken },
        select: { createdBy: true, bookId: true, expiresAt: true },
      });
      const bookData = await prisma.book.findUnique({ where: { id: bookId }, select: { enableReferral: true, referralDiscount: true } });
      if (shareLink && shareLink.expiresAt > new Date() && bookData?.enableReferral && shareLink.createdBy !== auth.userId) {
        referrerId = shareLink.createdBy;
        referralDiscountPct = bookData.referralDiscount ?? 20;
      }
    }

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
          referrerId,
          referrerToken,
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

    // Grant referral reward to referrer (best-effort)
    if (referrerId && referralDiscountPct > 0) {
      try {
        const couponCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await prisma.$transaction([
          prisma.referralReward.create({
            data: { referrerId, bookOrderId, discountPct: referralDiscountPct, couponCode },
          }),
          prisma.coupon.create({
            data: {
              code: couponCode,
              discount: referralDiscountPct,
              isActive: true,
            },
          }),
        ]);
      } catch (refErr) {
        console.error('[books paypal-capture referral]', refErr);
      }
    }

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

    // Cleanup pending Setting (best-effort)
    prisma.setting.delete({ where: { key: `pp_pending_${paypalOrderId}` } }).catch(() => {});

    return NextResponse.json({ orderId: bookOrderId, status: 'paid', granted: true });
  } catch (err) {
    if (err instanceof PayPalCaptureError) {
      console.error('[books paypal-capture] paypal rejected', {
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
    console.error('[books paypal-capture]', err);
    return NextResponse.json({ error: 'حدث خطأ في تأكيد الدفع' }, { status: 500 });
  }
}
