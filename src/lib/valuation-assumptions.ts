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

export async function saveValuationAssumptions(input: Partial<ValuationAssumptions>): Promise<ValuationAssumptions> {
  const current = await getValuationAssumptions();
  const merged: ValuationAssumptions = { ...current, ...sanitize(input) };
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  return merged;
}

function sanitize(input: Partial<ValuationAssumptions>): Partial<ValuationAssumptions> {
  const out: Partial<ValuationAssumptions> = {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
  if (num(input.cogsRatio) !== undefined && input.cogsRatio! <= 1) out.cogsRatio = input.cogsRatio;
  if (num(input.ipBookValue) !== undefined) out.ipBookValue = input.ipBookValue;
  if (num(input.ipProductValue) !== undefined) out.ipProductValue = input.ipProductValue;
  if (num(input.ipDigitalValue) !== undefined) out.ipDigitalValue = input.ipDigitalValue;
  if (num(input.techValue) !== undefined) out.techValue = input.techValue;
  if (num(input.customerDbValue) !== undefined) out.customerDbValue = input.customerDbValue;
  if (num(input.fairMultiplier) !== undefined && input.fairMultiplier! >= 1) out.fairMultiplier = input.fairMultiplier;
  if (num(input.strategicMultiplier) !== undefined && input.strategicMultiplier! >= 1) out.strategicMultiplier = input.strategicMultiplier;
  if (num(input.activeWindowDays) !== undefined && input.activeWindowDays! >= 1) out.activeWindowDays = Math.floor(input.activeWindowDays!);
  return out;
}
