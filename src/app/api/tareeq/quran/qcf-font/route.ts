export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/*
 * Server-side proxy for QCF V2 per-page Mushaf fonts.
 * fonts.qurancdn.com returns 403 on direct browser requests from non-quran.com
 * origins. This route fetches the font server-side and streams it back to the
 * browser with long-lived caching headers.
 *
 * Usage: /api/tareeq/quran/qcf-font?page=8
 * Source: https://fonts.qurancdn.com/QCF_P008_v2.woff2
 */
export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '0');
  if (page < 1 || page > 604) return new NextResponse(null, { status: 400 });

  const padded = String(page).padStart(3, '0');
  const url = `https://fonts.qurancdn.com/QCF_P${padded}_v2.woff2`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return new NextResponse(null, { status: res.status });

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
