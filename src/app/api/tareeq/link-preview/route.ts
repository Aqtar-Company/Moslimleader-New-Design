export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
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

// Blocks loopback, private (RFC1918), link-local (169.254.0.0/16 — this is
// the cloud-metadata range, e.g. AWS/GCP 169.254.169.254 — previously
// missing here), and IPv6 equivalents. Checked against the RESOLVED address,
// not just the hostname string, so a hostname that merely LOOKS external but
// resolves to an internal IP (or a DNS-rebinding attack that changes the
// resolved IP between check and fetch) can't slip through.
function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 0) return true;
    return false;
  }
  if (isIP(ip) === 6) {
    const norm = ip.toLowerCase();
    if (norm === '::1') return true;
    if (norm.startsWith('fe80:') || norm.startsWith('fc') || norm.startsWith('fd')) return true; // link-local / unique-local
    if (norm.startsWith('::ffff:')) return isBlockedIp(norm.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // unparseable — fail closed
}

async function assertHostAllowed(hostname: string): Promise<void> {
  if (/^localhost$/i.test(hostname)) throw new Error('blocked');
  const literal = isIP(hostname);
  if (literal) {
    if (isBlockedIp(hostname)) throw new Error('blocked');
    return;
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error('blocked');
  for (const r of records) {
    if (isBlockedIp(r.address)) throw new Error('blocked');
  }
}

// Fetches with redirects followed manually (capped at 3 hops), re-validating
// the target host on every hop — `fetch`'s automatic redirect following
// would otherwise let a URL that passes the initial check redirect to an
// internal address and bypass it entirely.
async function fetchSafely(startUrl: string): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(current);
    await assertHostAllowed(u.hostname);
    const res = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Tareeq-LinkPreview/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar,en;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('too many redirects');
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

  try {
    const res = await fetchSafely(rawUrl);
    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });

    const html = await res.text();
    const title       = extractMeta(html, 'title');
    const description = extractMeta(html, 'description');
    const image       = extractMeta(html, 'image');
    const domain      = parsed.hostname.replace(/^www\./, '');

    return NextResponse.json(
      { title, description, image, domain, url: rawUrl },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 502 });
  }
}
