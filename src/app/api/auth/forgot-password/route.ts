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

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    // Generate secure token (expires in 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://moslimleader.com';
    const resetUrl = `${siteUrl}/auth/reset-password?token=${token}`;

    // Use Titan Email SMTP (same as order emails)
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
      subject: 'إعادة تعيين كلمة المرور - مسلم ليدر',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;"><img src="${siteUrl}/Logo.webp" alt="مسلم ليدر" style="height: 60px;" /></div>
          <h2 style="color: #1a1a1a; text-align: center;">إعادة تعيين كلمة المرور</h2>
          <p style="color: #555;">مرحباً ${user.name}،</p>
          <p style="color: #555;">تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.</p>
          <p style="color: #555;">اضغط على الزر أدناه لإعادة تعيين كلمة المرور. الرابط صالح لمدة ساعة واحدة فقط.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #F5C518; color: #1a1a1a; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
              إعادة تعيين كلمة المرور
            </a>
          </div>
          <p style="color: #999; font-size: 13px;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #ccc; font-size: 12px; text-align: center;">مسلم ليدر - moslimleader.com</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
