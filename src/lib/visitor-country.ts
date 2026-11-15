import { prisma } from '@/lib/prisma';

/**
 * Remember which country a member signs up / signs in from — `User.country`.
 *
 * Until 2026-11-15 nothing on the sign-up paths wrote it: the only writer was طريق's profile
 * form, so 64% of the accounts made in the previous 30 days had no country at all, and the
 * question «are we reaching people outside Egypt?» could not be answered from the members
 * table. The site already worked the country out for prices (`/api/geo`) — it just never kept
 * it.
 *
 * Rules:
 *  - Only ever FILLS an empty value (`updateMany … where country: null`). A country the member
 *    chose themselves in طريق is never overwritten by a guess from their IP.
 *  - Never blocks or fails a sign-in: every call is fire-and-forget and swallows errors.
 *  - Sources, cheapest first: a country header from a proxy (Cloudflare / nginx geoip), then
 *    one lookup of the IP at ip-api.com — the same free service, over plain HTTP (its free
 *    tier has no HTTPS), that /api/books/[id]/track has used for months.
 *  - Each member is tried at most once per process run, so /api/auth/me — called on every
 *    page — costs nothing after the first time.
 */

const COUNTRY_RE = /^[A-Z]{2}$/;
const tried = new Set<string>();
const ipCache = new Map<string, string | null>();

function headerCountry(h: Headers): string | null {
  for (const name of ['cf-ipcountry', 'x-vercel-ip-country', 'x-country-code', 'x-geoip-country']) {
    const v = h.get(name)?.trim().toUpperCase();
    if (v && v !== 'XX' && COUNTRY_RE.test(v)) return v;
  }
  return null;
}

export function clientIp(h: Headers): string | null {
  let ip = h.get('cf-connecting-ip') || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  if (!ip) return null;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

function isPrivateIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (ip.startsWith('172.')) {
    const second = Number(ip.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
}

async function lookupIp(ip: string): Promise<string | null> {
  if (ipCache.has(ip)) return ipCache.get(ip) ?? null;
  let code: string | null = null;
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const j = await res.json() as { status?: string; countryCode?: string };
      const c = j.status === 'success' ? j.countryCode?.toUpperCase() : undefined;
      if (c && COUNTRY_RE.test(c)) code = c;
    }
  } catch { /* unknown is an answer too */ }
  if (ipCache.size > 5000) ipCache.clear();
  ipCache.set(ip, code);
  return code;
}

/** The visitor's ISO country code, or null when it cannot be told. */
export async function detectVisitorCountry(h: Headers): Promise<string | null> {
  const fromHeader = headerCountry(h);
  if (fromHeader) return fromHeader;
  const ip = clientIp(h);
  if (!ip || isPrivateIp(ip)) return null;
  return lookupIp(ip);
}

/**
 * Fill `User.country` for this member if it is empty. Fire-and-forget: call it with `void`.
 * `known` lets a caller that already loaded the user skip the work when the country is set.
 */
export async function rememberCountry(userId: string, h: Headers, known?: { country: string | null }): Promise<void> {
  try {
    if (!userId || tried.has(userId)) return;
    // Read the headers now: the caller does not wait, and the request may be finished by the
    // time the lookup runs.
    h = new Headers(h);
    if (known && known.country) { tried.add(userId); return; }
    tried.add(userId);
    if (tried.size > 50_000) tried.clear();
    const country = await detectVisitorCountry(h);
    if (!country) return;
    await prisma.user.updateMany({ where: { id: userId, OR: [{ country: null }, { country: '' }] }, data: { country } });
  } catch (err) {
    console.error('[visitor-country]', (err as Error)?.message ?? err);
  }
}
