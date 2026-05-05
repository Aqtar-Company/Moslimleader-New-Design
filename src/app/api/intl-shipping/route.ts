export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CONFIG, SETTING_KEY, mergeWithDefaults, type IntlShippingConfig } from '@/lib/intl-shipping';

// Public read of the international-shipping configuration. Used by:
//  - the customer checkout flow (calculate price for the destination)
//  - the admin UI for the initial render
// Cached server-side for 30s to soak load on the home/checkout pages.
const CACHE_TTL_MS = 30_000;
let cache: { value: IntlShippingConfig; expiresAt: number } | null = null;

export function invalidateIntlShippingCache(): void {
  cache = null;
}

export async function GET() {
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json({ config: cache.value, cached: true });
  }
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const value = (row?.value ?? null) as Partial<IntlShippingConfig> | null;
    const config = mergeWithDefaults(value);
    cache = { value: config, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json({ config });
  } catch (err) {
    console.error('[intl-shipping GET]', err);
    return NextResponse.json({ config: DEFAULT_CONFIG, source: 'defaults' });
  }
}
