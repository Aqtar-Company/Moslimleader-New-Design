/**
 * International Shipping — business logic and storage
 * Completely separate from local Egypt shipping (src/lib/shipping.ts)
 *
 * Zones:
 *   saudi        → Saudi Arabia only (prices in SAR ﷼)
 *   international → All other countries (prices in USD)
 */

export type IntlZone = 'saudi' | 'international';
export type RoundingRule = 'none' | 'whole' | 'friendly';

/** Map an ISO-2 country code to its international shipping zone.
 *  Returns null for Egypt (EG) — Egypt uses local shipping. */
export function getIntlZone(countryCode: string): IntlZone | null {
  if (countryCode === 'EG') return null;
  if (countryCode === 'SA') return 'saudi';
  return 'international';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeightBracket {
  id: string;
  minKg: number;
  maxKg: number | null; // null = open-ended (no upper limit)
  /** Manual prices — always take priority over formula */
  price_sar?: number;  // ﷼  — Saudi zone
  price_usd?: number;  // USD — International zone
  /** Formula fallback (used only when manual price is absent/zero) */
  use_formula: boolean;
  egp_base?: number;  // Base EGP shipping cost
  saudi_mult: number; // egp_base × saudi_mult = ﷼ price
  usd_mult: number;   // egp_base × usd_mult   = USD price
  rounding: RoundingRule;
}

export interface ZoneConfig {
  enabled: boolean;
  blockedCountries: string[]; // ISO-2 codes — shipping refused for these
}

export interface HandlingFee {
  enabled: boolean;
  type: 'fixed' | 'percentage';
  value: number;
}

export interface IntlShippingConfig {
  enabled: boolean; // master on/off — customers see nothing when false
  zones: {
    saudi:         ZoneConfig;
    international: ZoneConfig;
  };
  weightBrackets: WeightBracket[];
  handling:        HandlingFee;
  overweightMessage: string;
}

// ── Labels / Currency ─────────────────────────────────────────────────────────

export const ZONE_LABELS: Record<IntlZone, string> = {
  saudi:         '🇸🇦 المملكة العربية السعودية',
  international: '🌐 دولي (باقي العالم)',
};

export const ZONE_CURRENCY: Record<IntlZone, string> = {
  saudi:         '﷼',
  international: 'USD',
};

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ml-intl-shipping';

export const DEFAULT_CONFIG: IntlShippingConfig = {
  enabled: false,
  zones: {
    saudi:         { enabled: true, blockedCountries: [] },
    international: { enabled: true, blockedCountries: [] },
  },
  weightBrackets: [],
  handling: { enabled: false, type: 'fixed', value: 0 },
  overweightMessage: 'سيتم تحديد تكلفة الشحن بعد مراجعة الطلب',
};

export function getIntlShippingConfig(): IntlShippingConfig {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    const saved = JSON.parse(raw) as Partial<IntlShippingConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      zones: {
        saudi:         { ...DEFAULT_CONFIG.zones.saudi,         ...saved.zones?.saudi },
        international: { ...DEFAULT_CONFIG.zones.international, ...saved.zones?.international },
      },
      handling: { ...DEFAULT_CONFIG.handling, ...saved.handling },
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveIntlShippingConfig(config: IntlShippingConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ── Price Calculation ─────────────────────────────────────────────────────────

export type ShippingCalcResult =
  | { ok: false; reason: 'disabled' | 'zone_disabled' | 'country_blocked' | 'overweight' | 'no_brackets' | 'no_price'; message: string }
  | { ok: true;  amount: number; currency: string; zone: IntlZone };

function applyRounding(val: number, rule: RoundingRule): number {
  if (rule === 'whole')    return Math.ceil(val);
  if (rule === 'friendly') return Math.ceil(val / 5) * 5;
  return Math.round(val * 100) / 100;
}

function resolveZonePrice(bracket: WeightBracket, zone: IntlZone): number | null {
  const manual = zone === 'saudi' ? bracket.price_sar : bracket.price_usd;

  if (manual !== undefined && manual > 0) return manual;

  if (bracket.use_formula && bracket.egp_base && bracket.egp_base > 0) {
    const mult = zone === 'saudi' ? bracket.saudi_mult : bracket.usd_mult;
    if (mult > 0) {
      return applyRounding(bracket.egp_base * mult, bracket.rounding);
    }
  }

  return null;
}

export function calculateIntlShipping(
  weightKg: number,
  countryCode: string,
  config: IntlShippingConfig,
): ShippingCalcResult {
  if (!config.enabled) {
    return { ok: false, reason: 'disabled', message: 'الشحن الدولي غير متاح حاليًا' };
  }

  const zone = getIntlZone(countryCode);
  if (!zone) {
    return { ok: false, reason: 'disabled', message: 'استخدم الشحن المحلي لمصر' };
  }

  const zoneConfig = config.zones[zone];
  if (!zoneConfig.enabled) {
    return { ok: false, reason: 'zone_disabled', message: 'الشحن غير متاح لهذه المنطقة حاليًا' };
  }
  if (zoneConfig.blockedCountries.includes(countryCode)) {
    return { ok: false, reason: 'country_blocked', message: 'الشحن غير متاح لبلدك حاليًا' };
  }

  if (config.weightBrackets.length === 0) {
    return { ok: false, reason: 'no_brackets', message: 'الشحن الدولي غير متاح حاليًا' };
  }

  const bracket = config.weightBrackets
    .slice()
    .sort((a, b) => a.minKg - b.minKg)
    .find(b => weightKg >= b.minKg && (b.maxKg === null || weightKg <= b.maxKg));

  if (!bracket) {
    return { ok: false, reason: 'overweight', message: config.overweightMessage };
  }

  const raw = resolveZonePrice(bracket, zone);
  if (raw === null) {
    return { ok: false, reason: 'no_price', message: 'الشحن الدولي غير متاح حاليًا' };
  }

  let amount = raw;

  if (config.handling.enabled && config.handling.value > 0) {
    if (config.handling.type === 'percentage') {
      amount = applyRounding(amount * (1 + config.handling.value / 100), 'whole');
    } else {
      amount = Math.ceil(amount + config.handling.value);
    }
  }

  return { ok: true, amount, currency: ZONE_CURRENCY[zone], zone };
}
