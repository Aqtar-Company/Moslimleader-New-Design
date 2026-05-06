import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const TOKEN_COOKIE = 'ml_auth';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    // Dev only fallback — never reaches production
    return new TextEncoder().encode('dev-only-fallback-secret-not-for-production');
  }
  return new TextEncoder().encode(secret);
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
  // Token version snapshot at sign-time. Compared against User.tokenVersion
  // during verify (for admin/staff only) so that revoking a staff member or
  // explicitly forcing logout invalidates their cookie immediately.
  tokenVersion?: number;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const claim = payload as unknown as JwtPayload;
    // Enforce tokenVersion only for admin/staff JWTs to keep customer
    // page loads fast (no DB hit on every render). Promoted customers
    // are still safe — admin gates always re-fetch role/perms from DB
    // via getAuthUserWithPerms / /api/auth/me, so a stale customer
    // cookie can't impersonate a staff cookie. The tokenVersion bump
    // on promote is defensive: it ensures that once the user signs in
    // again with a fresh staff cookie, any old admin tab is also
    // invalidated.
    if (claim.role === 'admin' || claim.role === 'staff') {
      try {
        const { prisma } = await import('./prisma');
        const user = await prisma.user.findUnique({
          where: { id: claim.userId },
          select: { tokenVersion: true, role: true },
        });
        if (!user) return null;
        const carried = claim.tokenVersion ?? 0;
        if (carried < user.tokenVersion) return null;
      } catch (err) {
        // DB blip: don't lock everyone out — fall through with the JWT claim.
        console.error('[verifyToken tokenVersion]', err);
      }
    }
    return claim;
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getAuthUserFromRequest(req: NextRequest): Promise<JwtPayload | null> {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function makeAuthCookie(token: string) {
  return {
    name: TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };
}

export function makeClearCookie() {
  return {
    name: TOKEN_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 0,
    path: '/',
  };
}
