export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authEmail } from '@/lib/auth-email';
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

    // In the language the person uses the site in (cookie written by LanguageContext).


    const mail = authEmail('verify-resend', { name: user.name, url: verifyUrl, siteUrl, lang: req.cookies.get('ml_lang')?.value === 'en' ? 'en' : 'ar' });


    await transporter.sendMail({


      from: `"${mail.fromName}" <${smtpUser}>`,


      to: user.email,


      subject: mail.subject,


      html: mail.html,


    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[resend-verification]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
