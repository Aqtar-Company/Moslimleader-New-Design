export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: key,
        passwordHash,
        phone: phone || null,
        role,
        savedAddresses: [],
      },
    });

    const token = await signToken({ userId: user.id, email: user.email, role: user.role });
    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, savedAddresses: [] },
    });
    res.cookies.set(makeAuthCookie(token));
    return res;
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
