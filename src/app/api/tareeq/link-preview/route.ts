export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
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

// Blocks loopback, private (RFC1918), the full link-local range (including
// 169.254.0.0/16 — the cloud-metadata range, e.g. AWS/GCP
// 169.254.169.254), and IPv6 equivalents.
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
    // fe80::/10 (link-local) spans first-group 0xfe80-0xfebf, i.e. any of
    // fe8-feb as the first three hex digits — a plain startsWith('fe80:')
    // check (as an earlier version of this function had) only caught the
    // single fe80:: prefix and missed the rest of the /10 block.
    if (/^fe[89ab]/.test(norm)) return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true; // unique-local fc00::/7
    if (norm.startsWith('::ffff:')) return isBlockedIp(norm.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // unparseable — fail closed
}

// Resolves a hostname and returns the first address that passes the block
// list, throwing if it's a literal blocked IP, an unparseable/empty
// resolution, or every resolved address is blocked.
async function resolveAllowedAddress(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  if (/^localhost$/i.test(hostname)) throw new Error('blocked');
  const literal = isIP(hostname);
  if (literal) {
    if (isBlockedIp(hostname)) throw new Error('blocked');
    return { address: hostname, family: literal as 4 | 6 };
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error('blocked');
  for (const r of records) {
    if (isBlockedIp(r.address)) throw new Error('blocked');
  }
  const first = records[0];
  return { address: first.address, family: first.family === 6 ? 6 : 4 };
}

interface SimpleResponse { statusCode: number; headers: http.IncomingHttpHeaders; body: string; }

// Fetches a single hop using Node's http/https directly (not the global
// `fetch`) so a custom `lookup` can pin the TCP connection to the EXACT IP
// address that was already validated — closing a DNS-rebinding gap that
// plain `fetch(url)` can't: `fetch` (undici) re-resolves the hostname itself
// when it actually connects, so validating with `dns.lookup()` first and
// then calling `fetch(url)` leaves a window where a low-TTL DNS record can
// return a safe IP for the check and an internal one moments later for the
// real connection. Pinning the connection via `lookup` removes that window
// entirely — the hostname is still sent as the Host header / TLS SNI (via
// the `url` object), only the actual socket target is overridden.
function requestPinned(target: URL, address: string, family: 4 | 6): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const mod = target.protocol === 'https:' ? https : http;
    const req = mod.request(target, {
      lookup: (_hostname, _options, callback) => { callback(null, address, family); },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Tareeq-LinkPreview/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar,en;q=0.9',
        'Host': target.host,
      },
      timeout: 5000,
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const MAX_BYTES = 2 * 1024 * 1024; // 2MB cap — this is a link preview, not a download
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { req.destroy(); return; }
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

// Follows redirects manually (capped at 3 hops), re-resolving AND
// re-validating the target host on every hop, including the first request.
async function fetchSafely(startUrl: string): Promise<SimpleResponse> {
  let current = new URL(startUrl);
  for (let hop = 0; hop < 4; hop++) {
    const { address, family } = await resolveAllowedAddress(current.hostname);
    const res = await requestPinned(current, address, family);
    if (res.statusCode >= 300 && res.statusCode < 400) {
      const loc = res.headers.location;
      if (!loc) return res;
      current = new URL(loc, current);
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
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
    }

    const html = res.body;
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
