import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://moslimleader.com',
  'https://www.moslimleader.com',
  'http://localhost:3000',
];

export function middleware(req: NextRequest) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;
  if (pathname.includes('/webhook') || pathname.includes('/track/')) {
    return NextResponse.next();
  }

  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
