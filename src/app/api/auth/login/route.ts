export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, makeAuthCookie } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { allowed } = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: 'محاولات كثيرة، حاول بعد 15 دقيقة' }, { status: 429 });
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 400 });
    }

    const key = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: key } });
    if (!user) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    /**
     * An account created by signing in with Google or Facebook has NO password.
     *
     * Both OAuth callbacks create the row with `passwordHash: ''` (the column is not
     * nullable), and `bcrypt.compare(anything, '')` is false for ever. So every password
     * such a person types is refused, and the only answer they were given was «بيانات
     * الدخول غير صحيحة» — which sends them to try their passwords one after another
     * against a door that has no lock. It presented as «يقبل من الكمبيوتر ويرفض من
     * الهاتف»: on the computer they had pressed the Google button.
     *
     * Naming the provider does disclose that an address has an account and how it signs
     * in. Google and Facebook disclose exactly that themselves on their own sign-in
     * screens, and the alternative here is a locked-out member with no way to find out
     * why — so the trade is made deliberately, and the message points at the two real
     * exits: the provider button, or a reset that actually sets a password.
     */
    if (!user.passwordHash) {
      const acct = await prisma.oAuthAccount.findFirst({
        where: { userId: user.id },
        select: { provider: true },
      });
      const name = acct?.provider === 'facebook' ? 'Facebook' : acct?.provider === 'google' ? 'Google' : null;
      return NextResponse.json({
        error: name
          ? `هذا الحساب يسجّل الدخول بـ ${name}. اضغط «المتابعة بـ ${name}» بالأعلى، أو «نسيت كلمة المرور؟» لتعيين كلمة مرور لهذا البريد.`
          : 'هذا الحساب لا كلمة مرور له بعد. اضغط «نسيت كلمة المرور؟» لتعيين واحدة، أو ادخل بـ Google أو Facebook.',
        oauthOnly: true,
        provider: acct?.provider ?? null,
      }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'يرجى تأكيد بريدك الإلكتروني أولاً. تحقق من صندوق الوارد.', needsVerification: true, email: user.email },
        { status: 403 },
      );
    }

    // Stamp last login + carry token version so a future revoke can invalidate this cookie.
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(err => console.error('[login lastLoginAt]', err));

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tokenVersion: user.tokenVersion,
    });
    const isAdminLike = user.role === 'admin' || user.role === 'staff';
    const permissions = isAdminLike ? ((user.permissions as unknown[] | null) ?? []) : [];
    const res = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions,
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
