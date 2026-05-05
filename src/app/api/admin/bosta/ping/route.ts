export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { pingBosta } from '@/lib/bosta';
import { requirePerm } from '@/lib/permissions';

export async function GET() {
  const guard = await requirePerm('shipments.read');
  if ('response' in guard) return guard.response;
  try {
    const result = await pingBosta();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      ok: false,
      error: message,
      tokenConfigured: !!process.env.BOSTA_API_TOKEN,
      tokenLength: (process.env.BOSTA_API_TOKEN || '').trim().length,
      baseUrl: process.env.BOSTA_API_URL || '(default)',
    }, { status: 500 });
  }
}
