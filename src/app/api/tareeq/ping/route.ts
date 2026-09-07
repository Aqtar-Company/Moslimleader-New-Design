import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET|HEAD /api/tareeq/ping
 *
 * Connectivity probe for the offline banner. Deliberately does nothing:
 * no DB, no auth, no outbound calls — the only thing it proves is that the
 * browser can still reach *this* server, which is exactly what
 * `navigator.onLine` cannot tell us (it stays true on a captive portal).
 *
 * Do not point the probe at a route that does real work: /api/geo, the
 * previous target, performs external ipapi.co / ip-api.com lookups and only
 * exports GET, so a HEAD probe against it could report "offline" to a user
 * who is perfectly online.
 */
export async function GET() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export const HEAD = GET;
