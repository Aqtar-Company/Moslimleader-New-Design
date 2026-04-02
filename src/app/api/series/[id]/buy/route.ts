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

    const { id: seriesId } = await params;
    const { orderId, paymentMethod, price, currency } = await req.json();

    // Get series info
    const series = await prisma.bookSeries.findUnique({
      where: { id: seriesId },
      select: {
        id: true,
        name: true,
        cover: true,
        seriesPrice: true,
        books: {
          where: { isPublished: true },
          select: { id: true, title: true },
          orderBy: { seriesOrder: 'asc' },
        },
      },
    });

    if (!series) return NextResponse.json({ error: 'السلسلة غير موجودة' }, { status: 404 });

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, email: true, phone: true },
    });

    if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });

    // Save one BookOrder per book in the series (using the first book as the main reference)
    // We store the orderId with a suffix to link them
    const bookIds = series.books.map(b => b.id);
    const bookTitles = series.books.map(b => b.title).join('، ');

    // Create orders for all books in the series
    for (let i = 0; i < bookIds.length; i++) {
      const bookId = bookIds[i];
      const existing = await prisma.bookAccess.findUnique({
        where: { userId_bookId: { userId: auth.userId, bookId } },
      });
      if (!existing) {
        await prisma.bookOrder.create({
          data: {
            id: `${orderId}-${i + 1}`,
            userId: auth.userId,
            bookId,
            status: 'pending',
            price: i === 0 ? price : 0, // full price on first book, 0 on rest
            currency,
            paymentMethod,
          },
        });
      }
    }

    // Send email notification to admin
    const orderDate = new Date().toLocaleString('ar-EG', {
      timeZone: 'Africa/Cairo',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Arial,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1a1a2e,#2d1060);padding:24px;text-align:center;">
      <h1 style="color:#F5C518;margin:0;font-size:20px;">🎉 طلب شراء سلسلة جديد</h1>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">رقم الطلب</td><td style="padding:8px 0;font-weight:bold;font-size:14px;">#${orderId}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">السلسلة</td><td style="padding:8px 0;font-weight:bold;font-size:14px;">${series.name}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">الكتب (${series.books.length})</td><td style="padding:8px 0;font-size:13px;">${bookTitles}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">السعر</td><td style="padding:8px 0;font-weight:bold;color:#F5C518;font-size:18px;">${price} ${currency}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">طريقة الدفع</td><td style="padding:8px 0;font-weight:bold;font-size:14px;">${paymentMethod}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">المشتري</td><td style="padding:8px 0;font-weight:bold;font-size:14px;">${user.name || 'غير محدد'}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">الإيميل</td><td style="padding:8px 0;font-weight:bold;font-size:14px;">${user.email}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">التاريخ</td><td style="padding:8px 0;font-size:14px;">${orderDate}</td></tr>
      </table>
      <div style="margin-top:16px;padding:12px;background:#fff3cd;border-radius:8px;font-size:13px;color:#856404;">
        ⚠️ لتفعيل الوصول: اذهب للوحة الأدمن وفعّل الوصول لكل كتب السلسلة لهذا المستخدم بعد التحقق من الدفع.
      </div>
    </div>
  </div>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: '"Moslim Leader" <noreply@moslimleader.com>',
        to: 'info@moslimleader.com',
        subject: `📚 طلب سلسلة جديد #${orderId} — ${series.name}`,
        html: emailHtml,
      });
    } catch (mailErr) {
      console.error('[series buy] email error:', mailErr);
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err) {
    console.error('[series buy POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
