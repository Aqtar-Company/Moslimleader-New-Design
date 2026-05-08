import { prisma } from './prisma';

// Trusted gold-price source for the Zakat nisab calculation.
//
// PRIMARY SOURCE: manual entry from شعبة الذهب المصرية (daily fixing).
// The Egyptian local market carries a premium over the international
// spot (5–15% varying by demand) so for nisab purposes we want the
// local price the owner can verify against an authoritative Egyptian
// daily fixing. The manual entry is always preferred when present.
//
// FALLBACK SOURCE: goldprice.org international spot in EGP. We surface
// it as a "starting suggestion" the admin can adopt, but never silently
// override a recent manual entry with it.

const ONE_TROY_OUNCE_GRAMS = 31.1034768;
export const NISAB_GRAMS = 85; // gold standard nisab
export const SETTING_KEY = 'gold-price-egp-local';
export const STALE_DAYS = 7; // warn if manual entry older than this

export interface CachedGoldPrice {
  pricePerGram24K: number;     // EGP per gram, 24-karat
  source: 'manual' | 'goldprice.org';
  enteredAt: string;            // ISO timestamp
  note?: string;
}

export interface GoldPriceState extends CachedGoldPrice {
  isStale: boolean;
  daysOld: number;
  nisabValue: number; // = NISAB_GRAMS × pricePerGram24K
}

export async function getCachedGoldPrice(): Promise<CachedGoldPrice | null> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.value) return null;
  try {
    const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    if (typeof parsed?.pricePerGram24K === 'number' && parsed.enteredAt) return parsed as CachedGoldPrice;
  } catch { /* fall through */ }
  return null;
}

export async function getGoldPriceState(): Promise<GoldPriceState | null> {
  const cached = await getCachedGoldPrice();
  if (!cached) return null;
  const ageMs = Date.now() - new Date(cached.enteredAt).getTime();
  const daysOld = Math.floor(ageMs / 86400000);
  return {
    ...cached,
    daysOld,
    isStale: daysOld > STALE_DAYS,
    nisabValue: Math.round(cached.pricePerGram24K * NISAB_GRAMS * 100) / 100,
  };
}

export async function saveManualGoldPrice(pricePerGram24K: number, note?: string): Promise<CachedGoldPrice> {
  if (!Number.isFinite(pricePerGram24K) || pricePerGram24K <= 0) {
    throw new Error('السعر يجب أن يكون رقماً موجباً');
  }
  const value: CachedGoldPrice = {
    pricePerGram24K: Math.round(pricePerGram24K * 100) / 100,
    source: 'manual',
    enteredAt: new Date().toISOString(),
    note: note?.trim() || undefined,
  };
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  return value;
}

// Best-effort fetch from goldprice.org. The endpoint returns the spot
// price for one troy ounce of gold (XAU) in the requested currency.
// We divide by 31.1034768 to get the per-gram 24K price. Returns null
// on any failure — never throws — so the API route can degrade gracefully.
export async function fetchInternationalSpotEGP(): Promise<{ pricePerGram24K: number; source: string; fetchedAt: string } | null> {
  try {
    const res = await fetch('https://data-asg.goldprice.org/dbXRates/EGP', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MoslimLeaderZakat/1.0)',
        'Accept': 'application/json',
      },
      // Modest timeout so the admin doesn't wait if the upstream is slow.
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json() as { items?: Array<{ curr?: string; xauPrice?: number }> };
    const egpItem = data.items?.find(i => i.curr === 'EGP');
    if (!egpItem || typeof egpItem.xauPrice !== 'number' || egpItem.xauPrice <= 0) return null;
    const pricePerGram24K = egpItem.xauPrice / ONE_TROY_OUNCE_GRAMS;
    return {
      pricePerGram24K: Math.round(pricePerGram24K * 100) / 100,
      source: 'goldprice.org',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// Used by zakat-engine.ts to decide whether Zakat is due.
export function nisabValueOf(pricePerGram24K: number, grams: number = NISAB_GRAMS): number {
  return Math.round(pricePerGram24K * grams * 100) / 100;
}
