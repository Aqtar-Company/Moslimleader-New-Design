export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { signToken, makeAuthCookie } from '@/lib/jwt';

// Email regex — basic RFC 5322 subset
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name     = typeof body.name     === 'string' ? body.name.trim()     : '';
    const email    = typeof body.email    === 'string' ? body.email.trim()    : '';
    const password = typeof body.password === 'string' ? body.password        : '';
    const phone    = typeof body.phone    === 'string' ? body.phone.trim()    : null;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'الاسم طويل جداً' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ error: 'كلمة المرور طويلة جداً' }, { status: 400 });
    }
    if (phone && (phone.length > 20 || !/^[+\d\s()-]{7,20}$/.test(phone))) {
      return NextResponse.json({ error: 'رقم الهاتف غير صحيح' }, { status: 400 });
    }

    const key = email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: key } });
    if (existing) {
      return NextResponse.json({ error: 'البريد الإلكتروني مسجل بالفعل' }, { status: 409 });
    }

    // Admin role is granted via ADMIN_EMAIL env var — never hardcoded
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const role = (adminEmail && key === adminEmail) ? 'admin' : 'customer';
    const isAdmin = role === 'admin';

    const passwordHash = await bcrypt.hash(password, 10);

    // Admin accounts skip email verification
    const verificationToken = isAdmin ? null : crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = isAdmin ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name,
        email: key,
        passwordHash,
        phone: phone || null,
        role,
        savedAddresses: [],
        emailVerified: isAdmin,
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // Admin accounts get logged in immediately; customers must verify email first
    if (isAdmin) {
      const token = await signToken({ userId: user.id, email: user.email, role: user.role });
      const res = NextResponse.json({
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, savedAddresses: [] },
      });
      res.cookies.set(makeAuthCookie(token));
      return res;
    }

    // Send verification email
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://moslimleader.com';
      const verifyUrl = `${siteUrl}/verify-email?token=${verificationToken}`;

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
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
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
            <p style="color: #555;">شكراً لتسجيلك في مسلم ليدر! اضغط على الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك.</p>
            <p style="color: #555;">الرابط صالح لمدة 24 ساعة.</p>
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
    } catch (mailErr) {
      console.error('[register] email send failed:', mailErr);
      // Don't fail registration if email fails — user can resend
    }

    return NextResponse.json(
      { needsVerification: true, email: user.email },
      { status: 201 },
    );
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
