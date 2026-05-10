import { prisma } from './prisma';

// Tunable inputs to the company-valuation model. Stored in the Setting
// table so an admin can adjust assumptions without a redeploy. Default
// values match the historical hardcoded constants so the headline
// numbers don't shift when the row is missing.
export interface ValuationAssumptions {
  cogsRatio: number;          // fraction of retail price used as inventory cost (0–1)
  ipBookValue: number;        // EGP attributed per ORIGINAL authored book (Arabic / "both")
  ipBookTranslationValue: number; // EGP per translation / non-Arabic edition — fraction of original because the IP is derivative
  ipProductValue: number;     // EGP attributed per authored product
  ipDigitalValue: number;     // EGP flat — YouTube + PDFs + brand
  techValue: number;          // EGP — platform + admin + integrations
  customerDbValue: number;    // EGP per real BUYER (customer with at least one valid order)
  receivablesProvisionRate: number;   // 0–1, fraction of customer receivables written off as bad-debt provision
  wholesaleCustomerValue: number;     // EGP per wholesale customer — they buy in bulk, repeatedly; worth far more than a retail one
  supplierRelationshipValue: number;  // EGP per ACTIVE supplier — established sourcing relationships have switching cost
  fairMultiplier: number;     // base × this = balanced market value
  strategicMultiplier: number;// base × this = strategic-buyer value
  // Market-approach multipliers applied to TTM revenue. Egyptian SME
  // e-commerce typically trades 1.5x–3.0x annual revenue; high-margin
  // / high-growth pushes toward the upper bound.
  revenueMultipleLow: number;
  revenueMultipleHigh: number;
  activeWindowDays: number;   // a customer is "active" if they placed a valid order within this many days
}

export const DEFAULT_VALUATION_ASSUMPTIONS: ValuationAssumptions = {
  cogsRatio: 0.35,
  // ipBookValue = the Arabic original (the IP we authored). Halved
  // from the legacy 120k constant after owner review showed the old
  // figure assumed every translated edition was a separate original
  // work. Originals get the full per-book value below; translations
  // pick up ipBookTranslationValue (~12% of original — covers
  // translation+layout cost, not new IP).
  ipBookValue: 60000,
  ipBookTranslationValue: 7500,
  ipProductValue: 40000,
  ipDigitalValue: 350000,
  techValue: 800000,
  customerDbValue: 200,
  // 10% bad-debt provision is the conservative SME default in EG.
  // Set to 0 if the owner runs strict credit control, raise to 0.20+
  // for aged or risky books.
  receivablesProvisionRate: 0.10,
  // A wholesale customer typically reorders in case-quantities; even at
  // a conservative AOV × LTV estimate the relationship is worth a few
  // multiples of a retail buyer. 5,000 EGP is the floor.
  wholesaleCustomerValue: 5000,
  // An active supplier represents a vetted, negotiated capacity — the
  // cost of finding + onboarding a replacement is the lower bound here.
  supplierRelationshipValue: 2000,
  fairMultiplier: 1.25,
  strategicMultiplier: 1.55,
  revenueMultipleLow: 1.5,
  revenueMultipleHigh: 3.0,
  activeWindowDays: 90,
};

const KEY = 'valuation-assumptions';

export async function getValuationAssumptions(): Promise<ValuationAssumptions> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row?.value) return DEFAULT_VALUATION_ASSUMPTIONS;
  try {
    const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    return { ...DEFAULT_VALUATION_ASSUMPTIONS, ...parsed };
  } catch {
    return DEFAULT_VALUATION_ASSUMPTIONS;
  }
}

export interface SaveAssumptionsResult {
  saved: ValuationAssumptions;
  rejected: string[];      // fields the client sent that were dropped (wrong type / NaN)
  clamped: Array<{ field: keyof ValuationAssumptions; from: number; to: number }>;
}

export async function saveValuationAssumptions(input: Partial<ValuationAssumptions>): Promise<SaveAssumptionsResult> {
  const current = await getValuationAssumptions();
  const { sanitized, rejected, clamped } = sanitize(input);
  const merged: ValuationAssumptions = { ...current, ...sanitized };
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  return { saved: merged, rejected, clamped };
}

// Clamp out-of-range numerics to the legal interval and report what we
// adjusted so the caller can surface a warning to the user. Bad types
// (NaN, strings, etc) are dropped and surfaced in `rejected`.
function sanitize(input: Partial<ValuationAssumptions>): {
  sanitized: Partial<ValuationAssumptions>;
  rejected: string[];
  clamped: Array<{ field: keyof ValuationAssumptions; from: number; to: number }>;
} {
  const sanitized: Partial<ValuationAssumptions> = {};
  const rejected: string[] = [];
  const clamped: Array<{ field: keyof ValuationAssumptions; from: number; to: number }> = [];
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const take = (key: keyof ValuationAssumptions, min: number, max: number, integer = false) => {
    const v = input[key];
    if (v === undefined) return;
    if (!isNum(v)) { rejected.push(String(key)); return; }
    let next = v;
    if (next < min) { clamped.push({ field: key, from: next, to: min }); next = min; }
    if (next > max) { clamped.push({ field: key, from: next, to: max }); next = max; }
    if (integer) next = Math.floor(next);
    sanitized[key] = next as never;
  };
  // Caps tightened: previous bounds (e.g. 100M EGP per book) made
  // typos catastrophic — an extra zero would push the headline value
  // by an order of magnitude with no UI warning. The new ceilings are
  // generous for a small Egyptian SME publisher but reject obvious
  // typos. The save endpoint reports `clamped` fields back so the UI
  // can show "تم تعديل القيمة لتقع داخل النطاق المسموح".
  take('cogsRatio', 0, 1);
  take('ipBookValue', 0, 5_000_000);
  take('ipBookTranslationValue', 0, 1_000_000);
  take('ipProductValue', 0, 2_000_000);
  take('ipDigitalValue', 0, 10_000_000);
  take('techValue', 0, 5_000_000);
  take('customerDbValue', 0, 5_000);
  take('receivablesProvisionRate', 0, 1);
  take('wholesaleCustomerValue', 0, 500_000);
  take('supplierRelationshipValue', 0, 200_000);
  take('fairMultiplier', 1, 3);
  take('strategicMultiplier', 1, 5);
  take('revenueMultipleLow', 0, 6);
  take('revenueMultipleHigh', 0, 6);
  take('activeWindowDays', 1, 3650, true);
  return { sanitized, rejected, clamped };
}
