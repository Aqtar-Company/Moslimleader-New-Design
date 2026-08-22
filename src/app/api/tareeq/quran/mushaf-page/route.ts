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
        'Accept-Language': 'en-US,en;q=0.9',
        ...(referer ? { 'Referer': referer } : {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function serveImage(url: string, referer = ''): Promise<NextResponse | null> {
  try {
    const res = await fetchWithTimeout(url, 8000, referer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 2000) return null;
    return new NextResponse(buf, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=31536000',
      },
    });
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
  if (page < 1 || page > 604) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const n3 = String(page).padStart(3, '0');

  // CDN candidates — ordered by reliability
  const candidates: [string, string][] = [
    // quran.com CDN — primary (3-digit padded)
    [`https://static.qurancdn.com/images/v2/pages/page-${n3}.jpg`, 'https://quran.com/'],
    // qurancdn alternative path
    [`https://qurancdn.com/images/pages/page-${n3}.jpg`, 'https://qurancdn.com/'],
    // islamic.network high-res
    [`https://cdn.islamic.network/quran/images/high-resolution/${page}.png`, 'https://alquran.cloud/'],
    // everyayah GIF
    [`https://everyayah.com/quran_img/page${n3}.gif`, 'https://everyayah.com/'],
    // islamicfinder
    [`https://www.islamicfinder.org/quran/images/${page}.gif`, 'https://www.islamicfinder.org/'],
  ];

  for (const [url, referer] of candidates) {
    const r = await serveImage(url, referer);
    if (r) return r;
  }

  // Last resort: try quran.com verses API to get page_image field
  try {
    const apiRes = await fetchWithTimeout(
      `https://api.quran.com/api/v4/verses/by_page/${page}?per_page=1&fields=page_number`,
      6000,
    );
    if (apiRes.ok) {
      // Try fetching directly from qurancdn with page number
      const r = await serveImage(
        `https://static.qurancdn.com/images/v2/pages/page-${n3}.jpg`,
        'https://quran.com/',
      );
      if (r) return r;
    }
  } catch { /* ignore */ }

  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
