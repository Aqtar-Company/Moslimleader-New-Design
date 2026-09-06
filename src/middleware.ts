import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://moslimleader.com',
  'https://www.moslimleader.com',
  'http://localhost:3000',
];

// NOTE ON SCOPE: this middleware does CSRF origin checking only — it deliberately does
// NOT gate /tareeq or /tareeq-admin. Two dead helpers (isMobile, getJwtPayload) used to
// sit here suggesting otherwise; they were never called and have been removed so nobody
// mistakes this for an auth boundary.
//   - /tareeq is intentionally browsable by guests (TareeqLoginGate prompts on the
//     actions that actually require an account), so an auth redirect here would break it.
//   - /tareeq-admin is enforced per-route on the server (every /api/tareeq-admin/*
//     handler checks the role) plus client gating in AdminShell. That server-side check
//     is the real boundary.

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
