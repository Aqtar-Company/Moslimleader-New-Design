import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/geo
 * Returns the visitor's country code detected server-side from:
 * 1. Cloudflare CF-IPCountry header (most reliable)
 * 2. X-Vercel-IP-Country header
 * 3. X-Country-Code header (Hostinger/nginx custom)
 * 4. X-Real-IP → external geo lookup as last resort
 */
export async function GET(req: NextRequest) {
  // 1. Cloudflare header (most reliable — set by Cloudflare proxy)
  const cfCountry = req.headers.get('cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX' && cfCountry.length === 2) {
    return NextResponse.json({ country: cfCountry.toUpperCase(), source: 'cf' });
  }

  // 2. Vercel header
  const vercelCountry = req.headers.get('x-vercel-ip-country');
  if (vercelCountry && vercelCountry.length === 2) {
    return NextResponse.json({ country: vercelCountry.toUpperCase(), source: 'vercel' });
  }

  // 3. Custom header from nginx/Hostinger
  const customCountry = req.headers.get('x-country-code') || req.headers.get('x-geoip-country');
  if (customCountry && customCountry.length === 2) {
    return NextResponse.json({ country: customCountry.toUpperCase(), source: 'nginx' });
  }

  // 4. Get real IP and do server-side lookup (avoids CORS issues on mobile)
  const ip =
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;

  if (ip && ip !== '127.0.0.1' && ip !== '::1') {
    try {
      const res = await fetch(`https://ipapi.co/${ip}/country/`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'moslimleader-geo/1.0' },
      });
      if (res.ok) {
        const text = (await res.text()).trim().toUpperCase();
        if (text.length === 2 && /^[A-Z]{2}$/.test(text)) {
          return NextResponse.json({ country: text, source: 'ipapi-server' });
        }
      }
    } catch {}

    try {
      const res = await fetch(`https://ip-api.com/json/${ip}?fields=countryCode`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.countryCode && data.countryCode.length === 2) {
          return NextResponse.json({ country: data.countryCode.toUpperCase(), source: 'ip-api-server' });
        }
      }
    } catch {}
  }

  // Fallback: could not detect
  return NextResponse.json({ country: null, source: 'none' });
}
