export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireBroadcastAdmin } from '@/lib/admin-broadcast-auth';
import { sendBroadcastTest } from '@/lib/admin-broadcast';
import { checkRateLimit } from '@/lib/rate-limit';
import { logActionSafe } from '@/lib/audit-log';


// POST /api/admin/tareeq/broadcasts/[id]/test — deliver the message to the admin only, on
// the channels the message has enabled. No recipient rows, no counters: a rehearsal.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireBroadcastAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // A stuck click handler must not storm the admin's own devices and inbox.
  if (!checkRateLimit(`broadcast-test:${admin.userId}`, 10, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ error: 'كثير من الرسائل التجريبية — انتظر قليلاً' }, { status: 429 });
  }
  try {
    const result = await sendBroadcastTest(params.id, admin.userId);
    await logActionSafe({ actor: admin, action: 'tareeq.broadcast.test', entity: 'AdminBroadcast', entityId: params.id, metadata: result });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = (e as Error).message || '';
    // Validation messages are ours (Arabic) and safe to show; anything else is an SMTP or
    // web-push internals string and belongs in the logs.
    const ours = /[\u0600-\u06FF]/.test(msg);
    if (!ours) console.error('[admin-broadcast] test send failed', params.id, e);
    return NextResponse.json({ error: ours ? msg : 'فشل الإرسال التجريبي — راجع pm2 logs' }, { status: 400 });
  }
}
