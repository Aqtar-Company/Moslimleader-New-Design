export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { approveMLSupport } from '@/lib/support-system';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { mode, percent, amount, customerPays } = body;

  if (!mode || !['percent', 'fixed', 'final'].includes(mode)) {
    return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
  }

  try {
    if (mode === 'percent') {
      await approveMLSupport(params.id, user.userId, user.role, { mode, percent: Number(percent) });
    } else if (mode === 'fixed') {
      await approveMLSupport(params.id, user.userId, user.role, { mode, amount: Number(amount) });
    } else {
      await approveMLSupport(params.id, user.userId, user.role, { mode, customerPays: Number(customerPays) });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
