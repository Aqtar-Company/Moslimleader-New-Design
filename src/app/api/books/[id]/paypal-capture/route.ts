export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { capturePayPalOrder } from '@/lib/paypal';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false,
  tls: { rejectUnauthorized: false },
});

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

    // Send notification email (non-blocking)
    try {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { name: true, email: true, phone: true },
      });
      const emailHtml = buildBookOrderEmail({
        orderId: bookOrderId,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookCover: book.cover,
        price: expectedRounded,
        currency: 'USD',
        customerName: user?.name || 'ضيف',
        customerEmail: user?.email || '—',
        customerPhone: user?.phone || '—',
      });
      await transporter.sendMail({
        from: '"Moslim Leader Books" <noreply@moslimleader.com>',
        to: 'orders@moslimleader.com',
        subject: `📚 طلب كتاب رقمي #${bookOrderId} — ${book.title}`,
        html: emailHtml,
        replyTo: user?.email || undefined,
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

function buildBookOrderEmail(data: {
  orderId: string;
  bookTitle: string;
  bookAuthor: string | null;
  bookCover: string | null;
  price: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}): string {
  const orderDate = new Date().toLocaleString('ar-EG', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const coverSrc = data.bookCover?.startsWith('http')
    ? data.bookCover
    : data.bookCover
      ? `https://moslimleader.com${data.bookCover}`
      : 'https://moslimleader.com/white-Logo.webp';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:20px 10px;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(26,26,46,0.12);">
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#2d1060 100%);padding:32px 28px;text-align:center;">
      <img src="https://moslimleader.com/white-Logo.webp" alt="Moslim Leader" width="140" style="height:auto;margin-bottom:14px;" />
      <h1 style="color:#F5C518;margin:0;font-size:22px;font-weight:900;">📚 طلب كتاب رقمي مدفوع</h1>
      <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:13px;">تم تفعيل الوصول تلقائياً عبر PayPal</p>
    </div>

    <div style="padding:24px 28px;">
      <div style="display:flex;gap:16px;align-items:center;padding:16px;background:#f9fafb;border-radius:14px;border:1px solid #f3f4f6;">
        <img src="${coverSrc}" alt="${data.bookTitle}" width="72" height="96" style="width:72px;height:96px;border-radius:10px;object-fit:cover;border:1px solid #e5e7eb;" />
        <div>
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">الكتاب</p>
          <h2 style="margin:0;font-size:16px;color:#1a1a2e;font-weight:900;line-height:1.3;">${data.bookTitle}</h2>
          ${data.bookAuthor ? `<p style="margin:6px 0 0;font-size:12px;color:#6B7280;">${data.bookAuthor}</p>` : ''}
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:12px;">رقم الطلب</td>
          <td style="padding:10px 14px;font-weight:900;color:#1a1a2e;font-size:13px;font-family:monospace;">#${data.orderId}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:12px;">التاريخ</td>
          <td style="padding:10px 14px;color:#333;font-size:12px;">${orderDate}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:12px;">العميل</td>
          <td style="padding:10px 14px;font-weight:900;color:#1a1a2e;font-size:13px;">${data.customerName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:12px;">الإيميل</td>
          <td style="padding:10px 14px;color:#333;font-size:12px;">${data.customerEmail}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:12px;">طريقة الدفع</td>
          <td style="padding:10px 14px;color:#333;font-size:12px;">🅿️ PayPal</td>
        </tr>
        <tr style="background:#ECFDF5;">
          <td style="padding:14px;font-weight:bold;color:#047857;font-size:13px;">💰 المبلغ المدفوع</td>
          <td style="padding:14px;font-weight:900;color:#047857;font-size:20px;">${data.price.toFixed(2)} ${data.currency}</td>
        </tr>
      </table>

      <div style="margin-top:18px;padding:14px 16px;background:#ECFDF5;border-radius:12px;border-right:4px solid #10B981;">
        <p style="margin:0;font-weight:700;color:#047857;font-size:13px;">✅ تم تفعيل وصول العميل تلقائياً — لا حاجة لإجراء يدوي</p>
      </div>
    </div>

    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#2d1060 100%);padding:18px 28px;text-align:center;">
      <p style="color:rgba(255,255,255,0.45);font-size:11px;margin:0 0 4px;">moslimleader.com</p>
      <p style="color:#F5C518;font-size:12px;margin:0;font-weight:700;">جزاك الله خيرًا 🤍</p>
    </div>
  </div>
</body>
</html>`;
}
