export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

// Proxy the QCF4 per-page Madinah Mushaf font from qurancdn
// fonts.qurancdn.com/QCF4{003}.woff2 — page-specific font, each page has unique glyphs
export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '0');
  if (page < 1 || page > 604) return new NextResponse(null, { status: 400 });

  const padded = String(page).padStart(3, '0');
  const url = `https://fonts.qurancdn.com/QCF4${padded}.woff2`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return new NextResponse(null, { status: 404 });

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'font/woff2',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
