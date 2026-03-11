// ─── Pricing Zones ────────────────────────────────────────────────────────────

export type PricingZone = 'egypt' | 'saudi' | 'gulf' | 'world';
export type RoundingRule = 'none' | 'whole' | 'friendly';

export interface ZoneInfo {
  zone: PricingZone;
  currency: string;     // e.g. "USD"
  currencyAr: string;   // e.g. "ج.م"
  currencyEn: string;   // e.g. "EGP"
  label: string;        // Arabic label
  labelEn: string;      // English label
  flag: string;
}

export const ZONES: Record<PricingZone, ZoneInfo> = {
  egypt: { zone: 'egypt', currency: 'ج.م',   currencyAr: 'ج.م',   currencyEn: 'EGP',   label: 'مصر',       labelEn: 'Egypt',         flag: '🇪🇬' },
  saudi: { zone: 'saudi', currency: 'ر.س',   currencyAr: 'ر.س',   currencyEn: 'SAR',   label: 'السعودية',  labelEn: 'Saudi Arabia',  flag: '🇸🇦' },
  gulf:  { zone: 'gulf',  currency: 'خليجي', currencyAr: 'خليجي', currencyEn: 'Gulf',  label: 'الخليج',    labelEn: 'Gulf',          flag: '🌍' },
  world: { zone: 'world', currency: 'USD',   currencyAr: 'USD',   currencyEn: 'USD',   label: 'دولي',      labelEn: 'International', flag: '🌐' },
};

// Country code → zone
const COUNTRY_ZONE_MAP: Record<string, PricingZone> = {
  EG: 'egypt',
  SA: 'saudi',
  AE: 'gulf', KW: 'gulf', QA: 'gulf', BH: 'gulf', OM: 'gulf',
};

export function countryToZone(countryCode: string): PricingZone {
  return COUNTRY_ZONE_MAP[countryCode?.toUpperCase()] ?? 'world';
}

// ─── Geo Detection ────────────────────────────────────────────────────────────

export async function detectZone(): Promise<PricingZone> {
  // Try ipapi.co first
  try {
    const res = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.country_code) return countryToZone(data.country_code);
    }
  } catch {}

  // Fallback: ip-api.com
  try {
    const res = await fetch('https://ip-api.com/json/?fields=countryCode', {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.countryCode) return countryToZone(data.countryCode);
    }
  } catch {}

  return 'egypt'; // default: Egypt (main market)
}

// ─── Regional Pricing Config ──────────────────────────────────────────────────

export interface RegionalPricing {
  // Manual prices (admin sets these directly)
  price_egp_manual?: number;
  price_sar_manual?: number;
  price_gulf_manual?: number;
  price_usd_manual?: number;

  // Formula fallback settings
  use_formula_fallback: boolean;
  saudi_multiplier: number;   // SAR = base_egp × multiplier   e.g. 0.075
  gulf_multiplier: number;    // Gulf = base_egp × multiplier  e.g. 0.075
  usd_multiplier: number;     // USD = base_egp × multiplier   e.g. 0.020

  // Rounding rules
  rounding_rule_egp: RoundingRule;
  rounding_rule_sar: RoundingRule;
  rounding_rule_gulf: RoundingRule;
  rounding_rule_usd: RoundingRule;
}

export const DEFAULT_REGIONAL_PRICING: RegionalPricing = {
  use_formula_fallback: true,
  saudi_multiplier: 0.075,
  gulf_multiplier: 0.075,
  usd_multiplier: 0.020,
  rounding_rule_egp: 'whole',
  rounding_rule_sar: 'friendly',
  rounding_rule_gulf: 'friendly',
  rounding_rule_usd: 'friendly',
};

// ─── Rounding Logic ───────────────────────────────────────────────────────────

function friendlyRound(value: number, zone: PricingZone): number {
  if (zone === 'world') {
    // USD: X.99 pricing
    if (value <= 1) return 0.99;
    return Math.floor(value) + 0.99;
  }
  // SAR/Gulf: round to friendly whole prices ending in 0, 5, or 9
  const whole = Math.ceil(value);
  if (whole <= 5) return whole;
  // Aim for prices like 9, 19, 29, 39, 49 (ends in 9)
  const tens = Math.floor(whole / 10) * 10;
  return whole <= tens + 5 ? tens + 9 : tens + 9 + 10;
}

function applyRounding(value: number, rule: RoundingRule, zone: PricingZone): number {
  if (rule === 'none') return Math.round(value * 100) / 100;
  if (rule === 'whole') return Math.round(value);
  return friendlyRound(value, zone);
}

// ─── Price Resolution ─────────────────────────────────────────────────────────

export interface PriceResult {
  price: number;
  currency: string;      // Displayed currency (currencyAr)
  currencyEn: string;
  zone: PricingZone;
  isManual: boolean;     // true = admin-set manual price
}

export function resolvePrice(
  baseEgpPrice: number,
  zone: PricingZone,
  pricing: RegionalPricing | null | undefined,
): PriceResult {
  const p: RegionalPricing = pricing ?? DEFAULT_REGIONAL_PRICING;
  const egpBase = (p.price_egp_manual && p.price_egp_manual > 0)
    ? p.price_egp_manual
    : baseEgpPrice;

  if (zone === 'egypt') {
    const price = applyRounding(egpBase, p.rounding_rule_egp, 'egypt');
    return { price, currency: 'ج.م', currencyEn: 'EGP', zone, isManual: !!(p.price_egp_manual && p.price_egp_manual > 0) };
  }

  if (zone === 'saudi') {
    if (p.price_sar_manual && p.price_sar_manual > 0) {
      return { price: p.price_sar_manual, currency: 'ر.س', currencyEn: 'SAR', zone, isManual: true };
    }
    if (p.use_formula_fallback) {
      const calc = applyRounding(egpBase * p.saudi_multiplier, p.rounding_rule_sar, 'saudi');
      return { price: calc, currency: 'ر.س', currencyEn: 'SAR', zone, isManual: false };
    }
    // No price set → show EGP
    return { price: egpBase, currency: 'ج.م', currencyEn: 'EGP', zone: 'egypt', isManual: false };
  }

  if (zone === 'gulf') {
    if (p.price_gulf_manual && p.price_gulf_manual > 0) {
      return { price: p.price_gulf_manual, currency: 'خليجي', currencyEn: 'Gulf', zone, isManual: true };
    }
    if (p.use_formula_fallback) {
      const calc = applyRounding(egpBase * p.gulf_multiplier, p.rounding_rule_gulf, 'gulf');
      return { price: calc, currency: 'خليجي', currencyEn: 'Gulf', zone, isManual: false };
    }
    return { price: egpBase, currency: 'ج.م', currencyEn: 'EGP', zone: 'egypt', isManual: false };
  }

  // world / USD
  if (p.price_usd_manual && p.price_usd_manual > 0) {
    return { price: p.price_usd_manual, currency: 'USD', currencyEn: 'USD', zone, isManual: true };
  }
  if (p.use_formula_fallback) {
    const calc = applyRounding(egpBase * p.usd_multiplier, p.rounding_rule_usd, 'world');
    return { price: calc, currency: 'USD', currencyEn: 'USD', zone, isManual: false };
  }
  return { price: egpBase, currency: 'ج.م', currencyEn: 'EGP', zone: 'egypt', isManual: false };
}

// ─── Preview helper (for admin dashboard) ─────────────────────────────────────

export function previewAllZones(
  baseEgpPrice: number,
  pricing: RegionalPricing,
): Record<PricingZone, PriceResult> {
  return {
    egypt: resolvePrice(baseEgpPrice, 'egypt', pricing),
    saudi: resolvePrice(baseEgpPrice, 'saudi', pricing),
    gulf:  resolvePrice(baseEgpPrice, 'gulf',  pricing),
    world: resolvePrice(baseEgpPrice, 'world', pricing),
  };
}
