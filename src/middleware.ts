import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ALLOWED_ORIGINS = [
  'https://moslimleader.com',
  'https://www.moslimleader.com',
  'http://localhost:3000',
];

const TOKEN_COOKIE = 'ml_auth';

function isMobile(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') ?? '';
  return /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
}

async function getJwtPayload(req: NextRequest): Promise<{ userId: string } | null> {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'dev-only-fallback-secret-not-for-production'
    );
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/') {
    return NextResponse.next();
  }

  // CSRF guard for all API mutations
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return NextResponse.next();
  }

  if (pathname.includes('/webhook') || pathname.includes('/track/')) {
    return NextResponse.next();
  }

  const origin = req.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/api/:path*'],
};
