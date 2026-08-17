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

async function serveImage(url: string, referer = ''): Promise<NextResponse | null> {
  try {
    const res = await fetchWithTimeout(url, 5000, referer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) return null; // skip empty/placeholder responses
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

  const n = String(page).padStart(3, '0');

  // Step 1: Ask api.quran.com for the actual CDN image URL (same API used by our verses route)
  try {
    const apiRes = await fetchWithTimeout(
      `https://api.quran.com/api/v4/verses/by_page/${page}?per_page=1&fields=image_url,text_uthmani`,
      5000,
    );
    if (apiRes.ok) {
      const data = await apiRes.json();
      const imageUrl: string | undefined = data?.verses?.[0]?.image_url;
      if (imageUrl) {
        const r = await serveImage(imageUrl, 'https://quran.com/');
        if (r) return r;
      }
    }
  } catch { /* fall through */ }

  // Step 2: Known CDN candidates (with Referer headers for hotlink protection)
  const candidates: [string, string][] = [
    [`https://static.qurancdn.com/images/v2/pages/page-${n}.jpg`, 'https://quran.com/'],
    [`https://everyayah.com/quran_img/page${n}.gif`,               'https://everyayah.com/'],
    [`https://cdn.islamic.network/quran/images/high-resolution/${page}.png`, 'https://alquran.cloud/'],
    [`https://www.islamicfinder.org/quran/images/${page}.gif`,     'https://www.islamicfinder.org/'],
  ];

  for (const [url, referer] of candidates) {
    const r = await serveImage(url, referer);
    if (r) return r;
  }

  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
