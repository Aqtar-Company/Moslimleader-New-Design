export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { runChildBirthdays } from '@/lib/child-birthday';

// «يوم ميلاد الابن» — run once a day (morning, Cairo). See src/lib/child-birthday.ts.
//
// Authentication: shared CRON_SECRET, header `x-cron-key: <secret>` — the same convention as
// the other /api/cron routes. `?dry=1` counts who would be greeted without sending or
// claiming anything.

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-cron-key') === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const result = await runChildBirthdays({ dryRun: req.nextUrl.searchParams.get('dry') === '1' });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron child-birthday]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
