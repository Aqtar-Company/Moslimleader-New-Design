export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

function extractMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"'<>]+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+property=["']og:${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']twitter:${prop}["'][^>]+content=["']([^"'<>]+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+name=["']twitter:${prop}["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1].trim();
  }
  if (prop === 'title') {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`link-preview:${ip}`, 30, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const rawUrl = req.nextUrl.searchParams.get('url');
  if (!rawUrl) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Block internal/private addresses
  const hostname = parsed.hostname;
  if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1)/.test(hostname)) {
    return NextResponse.json({ error: 'Blocked' }, { status: 403 });
  }

  try {
    const res = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Tareeq-LinkPreview/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar,en;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });

    const html = await res.text();
    const title       = extractMeta(html, 'title');
    const description = extractMeta(html, 'description');
    const image       = extractMeta(html, 'image');
    const domain      = hostname.replace(/^www\./, '');

    return NextResponse.json(
      { title, description, image, domain, url: rawUrl },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 502 });
  }
}
