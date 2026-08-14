export const dynamic = 'force-dynamic';

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  signAdminToken,
  logAudit,
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE,
} from '@/lib/tareeq-admin-auth';

// Simple in-memory rate limiter: 10 attempts per 15 min per IP
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const key = `admin:${ip}`;
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    if (isRateLimited(ip)) {
      return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

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
        // 200 so client doesn't treat this as an error — it just shows the TOTP step
        return Response.json({ needsTotp: true }, { status: 200 });
      }
      if (!admin.totpSecret) {
        return Response.json({ error: 'TOTP not configured' }, { status: 500 });
      }
      const result = verifySync({ token: totpCode, secret: admin.totpSecret });
      const valid = result?.valid ?? false;
      if (!valid) {
        return Response.json({ error: 'Invalid TOTP code' }, { status: 401 });
      }
    }

    // ── 4. Create session ─────────────────────────────────────────────────────
    const userAgent = req.headers.get('user-agent') ?? undefined;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
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
