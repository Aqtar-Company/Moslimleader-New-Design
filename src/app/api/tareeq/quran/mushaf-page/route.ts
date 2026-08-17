export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuranReader/1.0)' },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
  if (page < 1 || page > 604) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const n = String(page).padStart(3, '0');
  const candidates = [
    `https://static.qurancdn.com/images/v2/pages/page-${n}.jpg`,
    `https://everyayah.com/quran_img/page${n}.gif`,
    `https://www.islamicfinder.org/quran/images/${page}.gif`,
    `https://quranpdf.com/quran-pages/page${n}.png`,
    `https://cdn.islamic.network/quran/images/high-resolution/${page}.png`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, 7000);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return new NextResponse(buf, {
          headers: {
            'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
            'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=31536000',
          },
        });
      }
    } catch { /* try next */ }
  }
  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
