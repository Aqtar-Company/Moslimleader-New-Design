export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { computeZakat, type ValuationMethod } from '@/lib/zakat-engine';

// Dry-run preview. Returns the full computation (all 4 valuation
// methods + the chosen one + pool + amount) without writing anything.
// Powers the live "احسب الآن" button on the page.
export async function POST(req: NextRequest) {
  const guard = await requirePerm('zakat.read');
  if ('response' in guard) return guard.response;

  let body: { method?: ValuationMethod; cashOnHand?: number; avgActualWindowDays?: number; manualValuation?: Record<string, number> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const method = (['retail', 'wholesale', 'avg-actual', 'manual'] as const).includes(body.method as ValuationMethod)
    ? body.method as ValuationMethod
    : 'retail';
  const cashOnHand = Number.isFinite(Number(body.cashOnHand)) ? Math.max(0, Number(body.cashOnHand)) : 0;
  const avgActualWindowDays = Number.isFinite(Number(body.avgActualWindowDays))
    ? Math.max(30, Math.min(365, Number(body.avgActualWindowDays)))
    : 90;

  const result = await computeZakat({
    method, cashOnHand, avgActualWindowDays,
    manualValuation: body.manualValuation,
  });
  return NextResponse.json(result);
}
