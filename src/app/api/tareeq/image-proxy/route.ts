export const dynamic = 'force-dynamic';

/**
 * Serve one of OUR OWN stored images back through our own origin.
 *
 * ## Why this exists
 *
 * The cover editor draws the picture into a canvas to crop it, so the canvas must not be
 * tainted — which is why its `<img>` carries `crossOrigin="anonymous"`. But that attribute
 * is not a request to be lenient: it is a demand. If the host answers without
 * `Access-Control-Allow-Origin`, the browser refuses to load the image AT ALL. The editor
 * then showed a black rectangle with a broken-image icon and no explanation.
 *
 * R2's public bucket does not send that header for us. It can be configured to — that is
 * the better fix and it lives in the Cloudflare console, not here — but the editor should
 * not be broken while that is arranged, and a same-origin image needs no CORS at all.
 *
 * ## Why this is not an open proxy
 *
 * A route that fetches any URL a caller names is an SSRF hole: it will read the cloud
 * metadata endpoint, anything on localhost, and anything inside the private network, using
 * the server's own credentials and address. So the URL is checked against OUR bucket's
 * public base and our own site, exactly, before a request is made — an allow-list of two
 * prefixes, not a blocklist of bad ones. Redirects are NOT followed, because a permitted
 * host that redirects elsewhere would walk straight around the check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { R2_PUBLIC_URL } from '@/lib/r2';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://moslimleader.com').replace(/\/+$/, '');

/** Only images, and only the few types this platform stores. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_BYTES = 12 * 1024 * 1024;

function isOurs(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const bases = [R2_PUBLIC_URL, SITE].filter(Boolean).map(b => b.replace(/\/+$/, ''));
  return bases.some(b => raw.startsWith(b + '/'));
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? '';
  if (!isOurs(url)) {
    return NextResponse.json({ error: 'not a permitted image' }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, { redirect: 'error', cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    }
    const type = upstream.headers.get('content-type') ?? '';
    if (!ALLOWED_TYPES.some(t => type.startsWith(t))) {
      return NextResponse.json({ error: 'not an image' }, { status: 415 });
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'too large' }, { status: 413 });
    }
    return new NextResponse(buf, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(buf.length),
        // Same-origin, so the canvas is clean without any CORS negotiation at all.
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
  }
}
