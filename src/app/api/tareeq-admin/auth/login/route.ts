export const dynamic = 'force-dynamic';

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  signAdminToken,
  logAudit,
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE,
} from '@/lib/tareeq-admin-auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, totpCode } = body as {
      email?: string;
      password?: string;
      totpCode?: string;
    };

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // ── 1. Look up admin ──────────────────────────────────────────────────────
    const admin = await prisma.tareeqAdmin.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // ── 2. Verify password ────────────────────────────────────────────────────
    const passwordOk = await bcrypt.compare(password, admin.password);
    if (!passwordOk) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // ── 3. TOTP check ─────────────────────────────────────────────────────────
    if (admin.totpEnabled) {
      if (!totpCode) {
        return Response.json({ error: 'TOTP code required', needsTotp: true }, { status: 401 });
      }
      if (!admin.totpSecret) {
        return Response.json({ error: 'TOTP not configured' }, { status: 500 });
      }
      const valid = authenticator.verify({ token: totpCode, secret: admin.totpSecret });
      if (!valid) {
        return Response.json({ error: 'Invalid TOTP code' }, { status: 401 });
      }
    }

    // ── 4. Create session ─────────────────────────────────────────────────────
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const userAgent = req.headers.get('user-agent') ?? undefined;
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ADMIN_COOKIE_MAX_AGE * 1000);

    const session = await prisma.tareeqAdminSession.create({
      data: {
        adminId: admin.id,
        token: sessionToken,
        ip,
        userAgent,
        expiresAt,
      },
    });

    // ── 5. Sign JWT ───────────────────────────────────────────────────────────
    const jwt = await signAdminToken(admin.id, session.id);

    // ── 6. Update last login ──────────────────────────────────────────────────
    await prisma.tareeqAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    // ── 7. Set cookie ─────────────────────────────────────────────────────────
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: '/',
    });

    // ── 8. Audit log ──────────────────────────────────────────────────────────
    await logAudit(admin.id, 'admin.login', { ip });

    return Response.json({
      ok: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        totpEnabled: admin.totpEnabled,
      },
      needsSetup: !admin.totpEnabled,
    });
  } catch (err) {
    console.error('[tareeq-admin/login]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
