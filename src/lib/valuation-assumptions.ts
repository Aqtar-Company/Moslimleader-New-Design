import { prisma } from './prisma';

// Tunable inputs to the company-valuation model. Stored in the Setting
// table so an admin can adjust assumptions without a redeploy. Default
// values match the historical hardcoded constants so the headline
// numbers don't shift when the row is missing.
export interface ValuationAssumptions {
  cogsRatio: number;          // fraction of retail price used as inventory cost (0–1)
  ipBookValue: number;        // EGP attributed per authored book
  ipProductValue: number;     // EGP attributed per authored product
  ipDigitalValue: number;     // EGP flat — YouTube + PDFs + brand
  techValue: number;          // EGP — platform + admin + integrations
  customerDbValue: number;    // EGP per registered customer
  fairMultiplier: number;     // base × this = balanced market value
  strategicMultiplier: number;// base × this = strategic-buyer value
  activeWindowDays: number;   // a customer is "active" if they placed a valid order within this many days
}

export const DEFAULT_VALUATION_ASSUMPTIONS: ValuationAssumptions = {
  cogsRatio: 0.35,
  ipBookValue: 120000,
  ipProductValue: 40000,
  ipDigitalValue: 350000,
  techValue: 800000,
  customerDbValue: 200,
  fairMultiplier: 1.25,
  strategicMultiplier: 1.55,
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
  take('cogsRatio', 0, 1);
  take('ipBookValue', 0, 100_000_000);
  take('ipProductValue', 0, 100_000_000);
  take('ipDigitalValue', 0, 100_000_000);
  take('techValue', 0, 100_000_000);
  take('customerDbValue', 0, 1_000_000);
  take('fairMultiplier', 1, 10);
  take('strategicMultiplier', 1, 20);
  take('activeWindowDays', 1, 3650, true);
  return { sanitized, rejected, clamped };
}
