import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, makeAuthCookie } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
    }

    const key = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: key } });
    if (existing) {
      return NextResponse.json({ error: 'البريد الإلكتروني مسجل بالفعل' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: key,
        passwordHash,
        phone: phone?.trim() || null,
        role: 'customer',
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
