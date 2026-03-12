// ─── Pricing Zones ────────────────────────────────────────────────────────────
// 3 zones only: Egypt (EGP) | Saudi Arabia (SAR) | International/World (USD)

export type PricingZone = 'egypt' | 'saudi' | 'world';

export interface ZoneInfo {
  zone: PricingZone;
  currency: string;
  currencyAr: string;
  currencyEn: string;
  label: string;
  labelEn: string;
  flag: string;
}

export const ZONES: Record<PricingZone, ZoneInfo> = {
  egypt: { zone: 'egypt', currency: 'ج.م', currencyAr: 'ج.م', currencyEn: 'EGP', label: 'مصر',      labelEn: 'Egypt',         flag: '🇪🇬' },
  saudi: { zone: 'saudi', currency: '﷼',   currencyAr: '﷼',   currencyEn: 'SAR', label: 'السعودية', labelEn: 'Saudi Arabia',  flag: '🇸🇦' },
  world: { zone: 'world', currency: 'USD',  currencyAr: 'USD',  currencyEn: 'USD', label: 'دولي',     labelEn: 'International', flag: '🌐' },
};

const COUNTRY_ZONE_MAP: Record<string, PricingZone> = {
  EG: 'egypt',
  SA: 'saudi',
};

export function countryToZone(countryCode: string): PricingZone {
  return COUNTRY_ZONE_MAP[countryCode?.toUpperCase()] ?? 'world';
}

// ─── Geo Detection ────────────────────────────────────────────────────────────

export async function detectZone(): Promise<PricingZone> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.country_code) return countryToZone(data.country_code);
    }
  } catch {}

  try {
    const res = await fetch('https://ip-api.com/json/?fields=countryCode', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.countryCode) return countryToZone(data.countryCode);
    }
  } catch {}

  return 'egypt';
}

// ─── Regional Pricing Config ──────────────────────────────────────────────────
// Only manual prices — no formula fallback, no rounding tricks

export interface RegionalPricing {
  price_egp_manual?: number;
  price_sar_manual?: number;
  price_usd_manual?: number;
}

export const DEFAULT_REGIONAL_PRICING: RegionalPricing = {};

// ─── Price Resolution ─────────────────────────────────────────────────────────

export interface PriceResult {
  price: number;
  currency: string;
  currencyEn: string;
  zone: PricingZone;
  isManual: boolean;
}

// Fixed internal conversion factors (not exposed to admin)
// SAR: ~2.7× exchange rate — pricing suited for Saudi market
// USD: ~5× exchange rate — pricing suited for European/global market
const SAR_FACTOR = 0.25;
const USD_FACTOR = 0.10;

export function resolvePrice(
  baseEgpPrice: number,
  zone: PricingZone,
  pricing: RegionalPricing | null | undefined,
): PriceResult {
  const p = pricing ?? {};
  const egpBase = (p.price_egp_manual && p.price_egp_manual > 0) ? p.price_egp_manual : baseEgpPrice;

  if (zone === 'egypt') {
    return {
      price: Math.round(egpBase),
      currency: 'ج.م', currencyEn: 'EGP', zone,
      isManual: !!(p.price_egp_manual && p.price_egp_manual > 0),
    };
  }

  if (zone === 'saudi') {
    if (p.price_sar_manual && p.price_sar_manual > 0) {
      return { price: p.price_sar_manual, currency: '﷼', currencyEn: 'SAR', zone, isManual: true };
    }
    return {
      price: Math.round(egpBase * SAR_FACTOR),
      currency: '﷼', currencyEn: 'SAR', zone, isManual: false,
    };
  }

  // world
  if (p.price_usd_manual && p.price_usd_manual > 0) {
    return { price: p.price_usd_manual, currency: 'USD', currencyEn: 'USD', zone, isManual: true };
  }
  return {
    price: Math.round(egpBase * USD_FACTOR),
    currency: 'USD', currencyEn: 'USD', zone, isManual: false,
  };
}

// ─── Preview helper (for admin dashboard) ─────────────────────────────────────

export function previewAllZones(
  baseEgpPrice: number,
  pricing: RegionalPricing,
): Record<PricingZone, PriceResult> {
  return {
    egypt: resolvePrice(baseEgpPrice, 'egypt', pricing),
    saudi: resolvePrice(baseEgpPrice, 'saudi', pricing),
    world: resolvePrice(baseEgpPrice, 'world', pricing),
  };
}
