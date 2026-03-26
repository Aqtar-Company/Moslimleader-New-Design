export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, makeAuthCookie } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 400 });
    }

    const key = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: key } });
    if (!user) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const token = await signToken({ userId: user.id, email: user.email, role: user.role });
    const res = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        savedAddresses: (user.savedAddresses as unknown[]) ?? [],
      },
    });
    res.cookies.set(makeAuthCookie(token));
    return res;
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
