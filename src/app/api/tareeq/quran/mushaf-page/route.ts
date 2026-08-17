export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

async function fetchWithTimeout(url: string, ms: number, referer = ''): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        ...(referer ? { 'Referer': referer } : {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
  if (page < 1 || page > 604) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const n = String(page).padStart(3, '0');
  // Each candidate paired with a Referer header that satisfies hotlink protection
  const candidates: [string, string][] = [
    [`https://static.qurancdn.com/images/v2/pages/page-${n}.jpg`, 'https://quran.com/'],
    [`https://everyayah.com/quran_img/page${n}.gif`,               'https://everyayah.com/'],
    [`https://cdn.islamic.network/quran/images/high-resolution/${page}.png`, 'https://alquran.cloud/'],
    [`https://www.islamicfinder.org/quran/images/${page}.gif`,     'https://www.islamicfinder.org/'],
    [`https://quranpdf.com/quran-pages/page${n}.png`,              'https://quranpdf.com/'],
  ];

  for (const [url, referer] of candidates) {
    try {
      const res = await fetchWithTimeout(url, 8000, referer);
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      // Must be an actual image — skip HTML error pages from CDNs
      if (!ct.startsWith('image/')) continue;
      const buf = await res.arrayBuffer();
      return new NextResponse(buf, {
        headers: {
          'Content-Type': ct,
          'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=31536000',
        },
      });
    } catch { /* try next */ }
  }
  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
