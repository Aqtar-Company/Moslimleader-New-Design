// ─── Pricing Zones ────────────────────────────────────────────────────────────
// 2 zones: Egypt (EGP) | World (USD base, converted to visitor's currency)

export type PricingZone = 'egypt' | 'world';

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
  egypt: { zone: 'egypt', currency: 'ج.م', currencyAr: 'ج.م', currencyEn: 'EGP', label: 'مصر', labelEn: 'Egypt', flag: '🇪🇬' },
  world: { zone: 'world', currency: 'USD',  currencyAr: 'USD',  currencyEn: 'USD', label: 'دولي', labelEn: 'International', flag: '🌐' },
};

// ─── Country Currencies ───────────────────────────────────────────────────────
// USD → local currency conversion (approximate fixed rates)

export interface CountryCurrency {
  currency: string;    // display symbol
  currencyEn: string;  // ISO code
  usdRate: number;     // 1 USD = X local
  nameAr: string;
  nameEn: string;
  flag: string;
}

export const COUNTRY_CURRENCIES: Record<string, CountryCurrency> = {
  // Gulf
  SA: { currency: '﷼',   currencyEn: 'SAR', usdRate: 3.75,  nameAr: 'السعودية',   nameEn: 'Saudi Arabia', flag: '🇸🇦' },
  AE: { currency: 'د.إ', currencyEn: 'AED', usdRate: 3.67,  nameAr: 'الإمارات',   nameEn: 'UAE',          flag: '🇦🇪' },
  KW: { currency: 'د.ك', currencyEn: 'KWD', usdRate: 0.307, nameAr: 'الكويت',     nameEn: 'Kuwait',       flag: '🇰🇼' },
  QA: { currency: 'ر.ق', currencyEn: 'QAR', usdRate: 3.64,  nameAr: 'قطر',        nameEn: 'Qatar',        flag: '🇶🇦' },
  BH: { currency: 'د.ب', currencyEn: 'BHD', usdRate: 0.376, nameAr: 'البحرين',    nameEn: 'Bahrain',      flag: '🇧🇭' },
  OM: { currency: 'ر.ع', currencyEn: 'OMR', usdRate: 0.385, nameAr: 'عُمان',       nameEn: 'Oman',         flag: '🇴🇲' },
  // Arab
  JO: { currency: 'د.أ', currencyEn: 'JOD', usdRate: 0.709, nameAr: 'الأردن',     nameEn: 'Jordan',       flag: '🇯🇴' },
  LB: { currency: '$',   currencyEn: 'USD', usdRate: 1,     nameAr: 'لبنان',      nameEn: 'Lebanon',      flag: '🇱🇧' },
  // International
  US: { currency: '$',   currencyEn: 'USD', usdRate: 1,     nameAr: 'أمريكا',     nameEn: 'USA',          flag: '🇺🇸' },
  GB: { currency: '£',   currencyEn: 'GBP', usdRate: 0.79,  nameAr: 'بريطانيا',   nameEn: 'UK',           flag: '🇬🇧' },
  DE: { currency: '€',   currencyEn: 'EUR', usdRate: 0.92,  nameAr: 'ألمانيا',    nameEn: 'Germany',      flag: '🇩🇪' },
  FR: { currency: '€',   currencyEn: 'EUR', usdRate: 0.92,  nameAr: 'فرنسا',      nameEn: 'France',       flag: '🇫🇷' },
  CA: { currency: 'C$',  currencyEn: 'CAD', usdRate: 1.36,  nameAr: 'كندا',       nameEn: 'Canada',       flag: '🇨🇦' },
  AU: { currency: 'A$',  currencyEn: 'AUD', usdRate: 1.55,  nameAr: 'أستراليا',   nameEn: 'Australia',    flag: '🇦🇺' },
  TR: { currency: '₺',   currencyEn: 'TRY', usdRate: 36,    nameAr: 'تركيا',      nameEn: 'Turkey',       flag: '🇹🇷' },
  // EU fallthrough
  IT: { currency: '€',   currencyEn: 'EUR', usdRate: 0.92,  nameAr: 'إيطاليا',    nameEn: 'Italy',        flag: '🇮🇹' },
  ES: { currency: '€',   currencyEn: 'EUR', usdRate: 0.92,  nameAr: 'إسبانيا',    nameEn: 'Spain',        flag: '🇪🇸' },
  NL: { currency: '€',   currencyEn: 'EUR', usdRate: 0.92,  nameAr: 'هولندا',     nameEn: 'Netherlands',  flag: '🇳🇱' },
  BE: { currency: '€',   currencyEn: 'EUR', usdRate: 0.92,  nameAr: 'بلجيكا',     nameEn: 'Belgium',      flag: '🇧🇪' },
  SE: { currency: 'kr',  currencyEn: 'SEK', usdRate: 10.3,  nameAr: 'السويد',     nameEn: 'Sweden',       flag: '🇸🇪' },
};

const COUNTRY_ZONE_MAP: Record<string, PricingZone> = {
  EG: 'egypt',
};

export function countryToZone(countryCode: string): PricingZone {
  return COUNTRY_ZONE_MAP[countryCode?.toUpperCase()] ?? 'world';
}

// ─── Geo Detection ────────────────────────────────────────────────────────────

export async function detectCountry(): Promise<string | null> {
  // Run all sources IN PARALLEL — return the first successful result
  // Max wait: 2000ms total (not 12+ seconds sequentially)
  const tryFetch = async (
    url: string,
    extract: (d: Record<string, unknown>) => string | null
  ): Promise<string | null> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return null;
      const data = await res.json() as Record<string, unknown>;
      return extract(data);
    } catch { return null; }
  };

  // Promise.any returns the first resolved (non-null) result
  // If all fail, returns null
  try {
    const result = await Promise.any([
      tryFetch('/api/geo',
        d => (typeof d.country === 'string' && d.country.length === 2) ? d.country : null
      ).then(r => r ?? Promise.reject()),
      tryFetch('https://ipapi.co/json/',
        d => (typeof d.country_code === 'string' && d.country_code.length === 2) ? d.country_code : null
      ).then(r => r ?? Promise.reject()),
      tryFetch('https://ip-api.com/json/?fields=countryCode',
        d => (typeof d.countryCode === 'string' && d.countryCode.length === 2) ? d.countryCode : null
      ).then(r => r ?? Promise.reject()),
    ]);
    return result;
  } catch {
    return null;
  }
}

export async function detectZone(): Promise<PricingZone> {
  const code = await detectCountry();
  return code ? countryToZone(code) : 'egypt';
}

// ─── Regional Pricing Config ──────────────────────────────────────────────────

export interface RegionalPricing {
  price_egp_manual?: number;
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

function smartRound(price: number): number {
  // Always round to nearest whole number for clean display
  return Math.round(price);
}

export function resolvePrice(
  baseEgpPrice: number,
  zone: PricingZone,
  pricing: RegionalPricing | null | undefined,
  countryCode?: string | null,
): PriceResult {
  const p = pricing ?? {};

  // مصر: استخدم سعر الجنيه اليدوي مباشرة، أو السعر الأساسي كاحتياط
  if (zone === 'egypt') {
    const egpPrice = (p.price_egp_manual && p.price_egp_manual > 0) ? p.price_egp_manual : baseEgpPrice;
    return {
      price: Math.round(egpPrice),
      currency: 'ج.م', currencyEn: 'EGP', zone,
      isManual: !!(p.price_egp_manual && p.price_egp_manual > 0),
    };
  }

  // دولي: استخدم سعر USD اليدوي فقط — بدون أي fallback
  if (!p.price_usd_manual || p.price_usd_manual <= 0) {
    // لا يوجد سعر USD محدد — أظهر السعر بالجنيه كاحتياط
    return { price: Math.round(baseEgpPrice), currency: 'ج.م', currencyEn: 'EGP', zone, isManual: false };
  }

  const usdPrice = p.price_usd_manual;

  // حول USD → عملة الدولة
  const cc = countryCode ? COUNTRY_CURRENCIES[countryCode.toUpperCase()] : null;
  if (cc) {
    return {
      price: smartRound(usdPrice * cc.usdRate),
      currency: cc.currency,
      currencyEn: cc.currencyEn,
      zone,
      isManual: true,
    };
  }

  return { price: usdPrice, currency: 'USD', currencyEn: 'USD', zone, isManual: true };
}

// ─── Preview helper (for admin dashboard) ─────────────────────────────────────

export function previewAllZones(
  baseEgpPrice: number,
  pricing: RegionalPricing,
): Record<PricingZone, PriceResult> {
  return {
    egypt: resolvePrice(baseEgpPrice, 'egypt', pricing),
    world: resolvePrice(baseEgpPrice, 'world', pricing),
  };
}
