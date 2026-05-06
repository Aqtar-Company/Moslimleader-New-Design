export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { DEFAULT_CONFIG, getCachedIntlShippingConfig } from '@/lib/intl-shipping';

// Public read of the international-shipping configuration. Used by:
//  - the customer checkout flow (calculate price for the destination)
//  - the admin UI for the initial render
// Cached server-side via the shared lib helper.
export async function GET() {
  try {
    const config = await getCachedIntlShippingConfig();
    return NextResponse.json({ config });
  } catch (err) {
    console.error('[intl-shipping GET]', err);
    return NextResponse.json({ config: DEFAULT_CONFIG, source: 'defaults' });
  }
}
