export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import {
  getGoldPriceState, saveManualGoldPrice, fetchInternationalSpotEGP,
  NISAB_GRAMS,
} from '@/lib/gold-price';

// GET — return the cached local gold price + nisab. Optional
// ?suggest=1 ALSO fetches the international spot from goldprice.org
// as a starting suggestion (best-effort, can fail silently).
export async function GET(req: NextRequest) {
  const guard = await requirePerm('zakat.read');
  if ('response' in guard) return guard.response;

  const wantSuggestion = req.nextUrl.searchParams.get('suggest') === '1';
  const [state, suggestion] = await Promise.all([
    getGoldPriceState(),
    wantSuggestion ? fetchInternationalSpotEGP() : Promise.resolve(null),
  ]);

  return NextResponse.json({
    state,
    suggestion,
    nisabGrams: NISAB_GRAMS,
  });
}

// POST — save a manual price entry from the admin (typically copied
// from the شعبة الذهب daily fixing page or another local source).
// Persists in Setting and becomes the new source-of-truth for nisab.
export async function POST(req: NextRequest) {
  const guard = await requirePerm('zakat.write');
  if ('response' in guard) return guard.response;

  let body: { pricePerGram24K?: number; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const price = Number(body.pricePerGram24K);
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'سعر الجرام يجب أن يكون رقماً موجباً' }, { status: 400 });
  }
  // Sanity bound — Egyptian 24K above ~50,000 EGP/g is implausible.
  if (price > 50000) {
    return NextResponse.json({ error: 'السعر يبدو مبالغاً فيه (>50,000 ج.م/جرام). راجع الرقم.' }, { status: 400 });
  }

  const saved = await saveManualGoldPrice(price, body.note);
  await logActionSafe({
    actor: guard.user, action: 'settings.update',
    entity: 'Setting', entityId: 'gold-price-egp-local',
    metadata: { source: 'manual', pricePerGram24K: saved.pricePerGram24K },
  });
  return NextResponse.json({ ok: true, state: saved });
}
