export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { getAuthUser } from '@/lib/jwt';
import { rejectSupportRequest } from '@/lib/support-system';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requirePerm('support-requests.write');
  if (denied) return denied;
  const user = await getAuthUser();

  const { reason = '' } = await req.json();

  try {
    await rejectSupportRequest(params.id, user.userId, user.role, reason);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
