export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { pingBosta } from '@/lib/bosta';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
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
