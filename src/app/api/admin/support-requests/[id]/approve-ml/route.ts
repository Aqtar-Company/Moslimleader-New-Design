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

  // F-03: reject NaN / negative / infinite inputs before they corrupt the ledger
  const isValidFinitePositive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

  try {
    if (mode === 'percent') {
      const pct = Number(percent);
      if (!isValidFinitePositive(pct) || pct > 100) return NextResponse.json({ error: 'invalid_percent' }, { status: 400 });
      await approveMLSupport(params.id, user.userId, user.role, { mode, percent: pct });
    } else if (mode === 'fixed') {
      const amt = Number(amount);
      if (!isValidFinitePositive(amt)) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
      await approveMLSupport(params.id, user.userId, user.role, { mode, amount: amt });
    } else {
      const cp = Number(customerPays);
      if (!isValidFinitePositive(cp)) return NextResponse.json({ error: 'invalid_customer_pays' }, { status: 400 });
      await approveMLSupport(params.id, user.userId, user.role, { mode, customerPays: cp });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
