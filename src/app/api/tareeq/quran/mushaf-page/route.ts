export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
  if (page < 1 || page > 604) return NextResponse.json({ error: 'invalid page' }, { status: 400 });

  const n = String(page).padStart(3, '0');
  const candidates = [
    `https://www.tanzil.net/res/img/quran/hafs/page/page-${n}.jpg`,
    `https://quranpdf.com/quran-pages/page${n}.png`,
    `https://cdn.islamic.network/quran/images/high-resolution/${page}.png`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IslamicApp/1.0)' },
      });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const ct  = res.headers.get('content-type') ?? 'image/jpeg';
        return new NextResponse(buf, {
          headers: {
            'Content-Type': ct,
            'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=31536000',
          },
        });
      }
    } catch { /* try next */ }
  }
  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
