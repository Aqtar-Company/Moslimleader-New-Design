import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false,
  tls: { rejectUnauthorized: false },
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });

    const { id: bookId } = await params;
    const { orderId, paymentMethod, price, currency } = await req.json();

    // Check if already has access
    const existing = await prisma.bookAccess.findUnique({
      where: { userId_bookId: { userId: auth.userId, bookId } },
    });
    if (existing) return NextResponse.json({ error: 'لديك وصول بالفعل لهذا الكتاب' }, { status: 400 });

    // Get book and user info
    const [book, user] = await Promise.all([
      prisma.book.findUnique({ where: { id: bookId }, select: { title: true, cover: true, author: true } }),
      prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true, email: true, phone: true } }),
    ]);

    if (!book) return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });

    // Save book order to DB
    await prisma.bookOrder.create({
      data: {
        id: orderId,
        userId: auth.userId,
        bookId,
        status: 'pending',
        price,
        currency,
        paymentMethod,
      },
    });

    // Send email notification to admin
    const orderDate = new Date().toLocaleString('ar-EG', {
      timeZone: 'Africa/Cairo',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Arial,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1a1a2e,#2d1060);padding:32px 24px;text-align:center;">
      <h1 style="color:#F5C518;margin:0;font-size:22px;font-weight:900;">📚 طلب كتاب رقمي جديد</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">moslimleader.com</p>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f8f9fa;">
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:13px;">رقم الطلب</td>
          <td style="padding:10px 14px;font-weight:900;color:#1a1a2e;font-size:15px;">#${orderId}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:13px;">التاريخ</td>
          <td style="padding:10px 14px;color:#333;font-size:13px;">${orderDate}</td>
        </tr>
        <tr style="background:#f8f9fa;">
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:13px;">الكتاب</td>
          <td style="padding:10px 14px;font-weight:900;color:#1a1a2e;font-size:14px;">${book.title}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:13px;">المؤلف</td>
          <td style="padding:10px 14px;color:#333;font-size:13px;">${book.author || '—'}</td>
        </tr>
        <tr style="background:#f8f9fa;">
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:13px;">اسم العميل</td>
          <td style="padding:10px 14px;font-weight:900;color:#1a1a2e;font-size:14px;">${user?.name || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:13px;">إيميل العميل</td>
          <td style="padding:10px 14px;color:#333;font-size:13px;">${user?.email || '—'}</td>
        </tr>
        <tr style="background:#f8f9fa;">
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:13px;">رقم الهاتف</td>
          <td style="padding:10px 14px;color:#333;font-size:13px;">${user?.phone || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:13px;">طريقة الدفع</td>
          <td style="padding:10px 14px;color:#333;font-size:13px;">${paymentMethod}</td>
        </tr>
        <tr style="background:#FFF8DC;">
          <td style="padding:12px 14px;font-weight:bold;color:#555;font-size:13px;">المبلغ</td>
          <td style="padding:12px 14px;font-weight:900;color:#1a1a2e;font-size:20px;">${price} ${currency}</td>
        </tr>
      </table>
      <div style="margin-top:20px;padding:16px;background:#FFF3CD;border-radius:12px;border-right:4px solid #F5C518;">
        <p style="margin:0;font-weight:bold;color:#856404;font-size:13px;">⏳ في انتظار إيصال التحويل من العميل</p>
        <p style="margin:6px 0 0;color:#856404;font-size:12px;">بعد استلام الإيصال، فعّل وصول العميل من لوحة الأدمن</p>
      </div>
      <div style="margin-top:16px;text-align:center;">
        <a href="https://moslimleader.com/admin/book-orders" style="display:inline-block;background:#1a1a2e;color:#F5C518;font-weight:900;padding:12px 28px;border-radius:12px;text-decoration:none;font-size:14px;">مراجعة الطلب في الأدمن ←</a>
      </div>
    </div>
    <div style="background:#1a1a2e;padding:16px 24px;text-align:center;">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0;">moslimleader.com — نظام إدارة الطلبات</p>
    </div>
  </div>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: '"Moslim Leader" <noreply@moslimleader.com>',
        to: 'orders@moslimleader.com',
        subject: `📚 طلب كتاب رقمي جديد #${orderId} — ${book.title}`,
        html: emailHtml,
      });
    } catch (emailErr) {
      console.error('[book buy email]', emailErr);
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err) {
    console.error('[book buy POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
