export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { checkRateLimit } from '@/lib/rate-limit';

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#34': '"',
};
/** `&amp;` in an attribute is one character, not five. */
function decodeEntities(s: string): string {
  return s
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name: string) => {
      const key = name.toLowerCase();
      if (ENTITIES[key]) return ENTITIES[key];
      if (/^#x/i.test(name)) return String.fromCodePoint(parseInt(name.slice(2), 16));
      if (/^#/.test(name)) return String.fromCodePoint(parseInt(name.slice(1), 10));
      return whole;
    })
    .trim();
}

/**
 * Reads one og:/twitter: value out of the raw HTML.
 *
 * The attribute value is matched up to its OWN closing quote — `[^"'<>]+` (what this used
 * to be) stops dead at the first apostrophe inside a double-quoted title, so any page whose
 * og:title contained one returned null here and the composer's card vanished.
 */
function extractMeta(html: string, prop: string): string | null {
  const keys = [`og:${prop}`, `twitter:${prop}`, prop === 'description' ? 'description' : ''];
  for (const key of keys) {
    if (!key) continue;
    const attr = key.startsWith('twitter:') || key === 'description' ? 'name' : 'property';
    const esc = key.replace(/[:]/g, '\\:');
    const patterns = [
      // attribute first, then content
      new RegExp(`<meta[^>]*\\s(?:${attr}|property|name)=["']${esc}["'][^>]*\\scontent=["']([\\s\\S]*?)["'][^>]*>`, 'i'),
      // content first, then attribute
      new RegExp(`<meta[^>]*\\scontent=["']([\\s\\S]*?)["'][^>]*\\s(?:${attr}|property|name)=["']${esc}["'][^>]*>`, 'i'),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]?.trim()) return decodeEntities(m[1]);
    }
  }
  if (prop === 'title') {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (m?.[1]?.trim()) return decodeEntities(m[1].replace(/\s+/g, ' '));
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
/** The response plus where the redirect chain actually ended. */
interface FetchResult extends SimpleResponse { finalUrl: string }

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
/**
 * The identity we fetch as, and why it is not a name of our own.
 *
 * A bespoke `Tareeq-LinkPreview/1.0` is an unknown agent: Cloudflare, Sucuri and most
 * managed WordPress hosts answer it 403, and a 403 here reaches the composer as "nothing
 * to show", which is exactly the blank the author reported. `facebookexternalhit` is the
 * agent every one of those front-ends is configured to LET THROUGH — serving it og: tags
 * is the whole point of having them — and it is honest about what we are doing: reading
 * the tags a page publishes for link previews. The browser string is the second attempt,
 * for the few sites that block bots and serve people.
 */
const UA_PREVIEW = 'facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)';
const UA_BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
function requestPinned(target: URL, address: string, family: 4 | 6, ua: string): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const mod = target.protocol === 'https:' ? https : http;
    const req = mod.request(target, {
      lookup: (_hostname, _options, callback) => { callback(null, address, family); },
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        // Node's http does not decompress, and a body we cannot read is indistinguishable
        // from a page with no tags. We ask for the encodings we decode below, and decode
        // whatever comes back — including one a server sends unasked, which happens.
        'Accept-Encoding': 'gzip, deflate, br',
        'Host': target.host,
      },
      // 5s was too short for a slow shared host; a preview may take its time, the
      // composer is already showing a spinner and the author is still typing.
      timeout: 9000,
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
        const raw = Buffer.concat(chunks);
        const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
        let body: string;
        try {
          const out =
            enc.includes('br')      ? zlib.brotliDecompressSync(raw)
          : enc.includes('gzip')    ? zlib.gunzipSync(raw)
          : enc.includes('deflate') ? zlib.inflateSync(raw)
          : raw;
          body = out.toString('utf-8');
        } catch {
          // A truncated body (we cap at 2MB) cannot be inflated. The tags live in <head>,
          // so read what decompressed before the cut rather than losing the whole page.
          try {
            body = zlib.gunzipSync(raw, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf-8');
          } catch { body = raw.toString('utf-8'); }
        }
        resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body });
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
async function fetchSafely(startUrl: string, ua: string): Promise<FetchResult> {
  let current = new URL(startUrl);
  for (let hop = 0; hop < 4; hop++) {
    const { address, family } = await resolveAllowedAddress(current.hostname);
    const res = await requestPinned(current, address, family, ua);
    if (res.statusCode >= 300 && res.statusCode < 400) {
      const loc = res.headers.location;
      if (!loc) return { ...res, finalUrl: current.toString() };
      current = new URL(loc, current);
      continue;
    }
    // The end of the chain is the answer for short links: Facebook's /share/v/<id> URLs
    // are redirects, and its video embed plugin needs the canonical URL they land on.
    return { ...res, finalUrl: current.toString() };
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

  const domain = parsed.hostname.replace(/^www\./, '');
  /**
   * A page we could not read is still a link the author typed, so the answer is 200 with
   * the domain and a `reason`, never a 502.
   *
   * This route used to answer 502 for every unhappy path, and the composer turned any
   * non-ok response into `state = 'empty'`, which renders NOTHING — «جارٍ قراءة الرابط…»
   * followed by a card that silently disappears, with no way for anyone to tell a site
   * with no og: tags from a block, a timeout or a bug of ours. `reason` is what tells
   * them apart, and it is why the diagnosis now takes one curl instead of a guess.
   */
  const bare = (reason: string) =>
    NextResponse.json(
      { title: null, description: null, image: null, domain, url: rawUrl, finalUrl: rawUrl, reason },
      { headers: { 'Cache-Control': 'public, max-age=120' } },
    );

  try {
    let res = await fetchSafely(rawUrl, UA_PREVIEW);
    // A few front-ends serve people and refuse bots. Ask once more as a browser before
    // giving up — the alternative is a blank card on a page that renders fine for anyone.
    if (res.statusCode === 403 || res.statusCode === 406 || res.statusCode === 429) {
      try { res = await fetchSafely(rawUrl, UA_BROWSER); } catch { /* keep the first answer */ }
    }
    if (res.statusCode < 200 || res.statusCode >= 300) return bare(`http:${res.statusCode}`);

    const html = res.body;
    const title       = extractMeta(html, 'title');
    const description = extractMeta(html, 'description');
    let image         = extractMeta(html, 'image');
    // og:image is allowed to be relative, and a relative src in the composer's <img>
    // resolves against moslimleader.com — a broken image on every such page.
    if (image) {
      try { image = new URL(image, res.finalUrl).toString(); } catch { image = null; }
    }

    if (!title && !image) return bare('no-tags');

    return NextResponse.json(
      { title, description, image, domain, url: rawUrl, finalUrl: res.finalUrl, reason: 'ok' },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return bare(msg === 'blocked' ? 'blocked-host' : msg === 'timeout' ? 'timeout' : `fetch:${msg}`);
  }
}
