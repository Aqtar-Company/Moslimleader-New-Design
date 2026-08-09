export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { assignSponsoredCopy } from '@/lib/support-system';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { copyId } = await req.json();
  if (!copyId) return NextResponse.json({ error: 'missing_copyId' }, { status: 400 });

  try {
    await assignSponsoredCopy(params.id, copyId, user.userId, user.role);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
