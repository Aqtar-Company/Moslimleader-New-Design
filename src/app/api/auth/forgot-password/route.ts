export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authEmail } from '@/lib/auth-email';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    // A one-minute window: a person who mistyped a few times waits seconds, not a quarter
    // of an hour. The answer says exactly how many seconds are left.
    const { allowed, retryAfterMs } = checkRateLimit(`forgot:${ip}`, 3, 60 * 1000);
    if (!allowed) {
      const secs = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return NextResponse.json(
        { error: `محاولات كثيرة، حاول بعد ${secs} ثانية`, retryAfterSec: secs },
        { status: 429, headers: { 'Retry-After': String(secs) } },
      );
    }

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

    // In the language the person uses the site in (cookie written by LanguageContext).


    const mail = authEmail('reset', { name: user.name, url: resetUrl, siteUrl, lang: req.cookies.get('ml_lang')?.value === 'en' ? 'en' : 'ar' });


    await transporter.sendMail({


      from: `"${mail.fromName}" <${smtpUser}>`,


      to: user.email,


      subject: mail.subject,


      html: mail.html,


    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
