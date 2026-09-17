export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { sendBroadcastTest } from '@/lib/admin-broadcast';

async function requireAdmin() {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  return user;
}

// POST /api/admin/tareeq/broadcasts/[id]/test — deliver the message to the admin only, on
// the channels the message has enabled. No recipient rows, no counters: a rehearsal.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await sendBroadcastTest(params.id, admin.userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'تعذّر الإرسال التجريبي' }, { status: 400 });
  }
}
