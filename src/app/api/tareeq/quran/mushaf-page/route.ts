export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getQFToken, QF_CLIENT_ID_VALUE } from '@/lib/qf-token';

async function fetchWithTimeout(url: string, ms: number, headers: Record<string, string> = {}): Promise<Response> {
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
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function serveImage(url: string, extraHeaders: Record<string, string> = {}): Promise<NextResponse | null> {
  try {
    const res = await fetchWithTimeout(url, 8000, extraHeaders);
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

  // Step 1: Quran Foundation authenticated API → get page image URL
  try {
    const token = await getQFToken();
    if (token && QF_CLIENT_ID_VALUE) {
      const apiRes = await fetchWithTimeout(
        `https://apis.quran.foundation/content/api/v4/verses/by_page/${page}?per_page=1&mushaf=1`,
        8000,
        { 'x-auth-token': token, 'x-client-id': QF_CLIENT_ID_VALUE, 'Accept': 'application/json' },
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        const imageUrl: string | undefined = data?.verses?.[0]?.image_url
          ?? data?.page_image
          ?? data?.meta?.image_url;
        if (imageUrl) {
          const r = await serveImage(imageUrl, { 'Referer': 'https://quran.com/' });
          if (r) return r;
        }
        // If API responded but no image_url, try QF CDN directly with auth
        const qfCdn = `https://static.qurancdn.com/images/v2/pages/page-${n3}.jpg`;
        const r = await serveImage(qfCdn, {
          'Referer': 'https://quran.com/',
          'x-auth-token': token,
          'x-client-id': QF_CLIENT_ID_VALUE,
        });
        if (r) return r;
      }
    }
  } catch { /* fall through */ }

  // Step 2: Public CDN candidates
  const candidates: [string, Record<string, string>][] = [
    [`https://static.qurancdn.com/images/v2/pages/page-${n3}.jpg`, { 'Referer': 'https://quran.com/' }],
    [`https://qurancdn.com/images/pages/page-${n3}.jpg`,           { 'Referer': 'https://qurancdn.com/' }],
    [`https://cdn.islamic.network/quran/images/high-resolution/${page}.png`, { 'Referer': 'https://alquran.cloud/' }],
    [`https://everyayah.com/quran_img/page${n3}.gif`,              { 'Referer': 'https://everyayah.com/' }],
    [`https://www.islamicfinder.org/quran/images/${page}.gif`,     { 'Referer': 'https://www.islamicfinder.org/' }],
  ];

  for (const [url, headers] of candidates) {
    const r = await serveImage(url, headers);
    if (r) return r;
  }

  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
