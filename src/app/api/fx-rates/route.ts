export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ensureFreshRates, currentRates } from '@/lib/fx-rates';

// GET /api/fx-rates — the USD → local rates the server is using today (see src/lib/fx-rates.ts).
// The browser applies them so the prices it shows match what the PayPal routes compute.
export async function GET() {
  await ensureFreshRates();
  return NextResponse.json(currentRates(), { headers: { 'cache-control': 'public, max-age=3600' } });
}
