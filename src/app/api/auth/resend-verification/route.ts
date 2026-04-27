export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 });
    }

    const key = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: key } });

    // Return success even if not found — prevent email enumeration
    if (!user || user.emailVerified) {
      return NextResponse.json({ ok: true });
    }

    // Throttle: only resend if last token issued > 2 minutes ago
    if (
      user.verificationTokenExpiry &&
      user.verificationTokenExpiry.getTime() - Date.now() > 24 * 60 * 60 * 1000 - 2 * 60 * 1000
    ) {
      return NextResponse.json(
        { error: 'يرجى الانتظار دقيقتين قبل إعادة الإرسال' },
        { status: 429 },
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: token, verificationTokenExpiry: expiry },
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://moslimleader.com';
    const verifyUrl = `${siteUrl}/verify-email?token=${token}`;

    const smtpHost = process.env.SMTP_HOST || 'smtp.titan.email';
    const smtpPort = parseInt(process.env.SMTP_PORT || '465');
    const smtpUser = process.env.SMTP_USER || 'orders@moslimleader.com';
    const smtpPass = process.env.SMTP_PASS || '';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: `"مسلم ليدر" <${smtpUser}>`,
      to: user.email,
      subject: 'تأكيد البريد الإلكتروني - مسلم ليدر',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;"><img src="${siteUrl}/Logo.webp" alt="مسلم ليدر" style="height: 60px;" /></div>
          <h2 style="color: #1a1a1a; text-align: center;">تأكيد البريد الإلكتروني</h2>
          <p style="color: #555;">مرحباً ${user.name}،</p>
          <p style="color: #555;">اضغط على الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك. الرابط صالح لمدة 24 ساعة.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}"
               style="background-color: #F5C518; color: #1a1a1a; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
              تأكيد البريد الإلكتروني
            </a>
          </div>
          <p style="color: #999; font-size: 13px;">إذا لم تسجّل في موقعنا، يمكنك تجاهل هذا البريد.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #ccc; font-size: 12px; text-align: center;">مسلم ليدر - moslimleader.com</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[resend-verification]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
