export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireBroadcastAdmin } from '@/lib/admin-broadcast-auth';
import { prisma } from '@/lib/prisma';
import { logActionSafe } from '@/lib/audit-log';
import { BROADCAST_LIST_SELECT } from '@/lib/admin-broadcast';


// POST /api/admin/tareeq/broadcasts/[id]/cancel — stop a running send.
// The runner re-reads the status before every chunk of 100, so at most one more chunk goes
// out after this returns. Rows still `queued` stay queued: "send" on a canceled broadcast
// resumes them, so a pause is possible as well as a stop.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireBroadcastAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.adminBroadcast.findUnique({ where: { id: params.id }, select: { status: true, title: true } });
  if (!existing) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
  if (existing.status !== 'sending') return NextResponse.json({ error: 'الرسالة ليست قيد الإرسال' }, { status: 400 });

  const broadcast = await prisma.adminBroadcast.update({
    where: { id: params.id },
    data: { status: 'canceled', finishedAt: new Date() },
    select: BROADCAST_LIST_SELECT,
  });
  await logActionSafe({
    actor: admin,
    action: 'tareeq.broadcast.cancel',
    entity: 'AdminBroadcast',
    entityId: params.id,
    metadata: { title: existing.title, processed: broadcast.processedCount, of: broadcast.recipientCount },
  });
  return NextResponse.json({ broadcast });
}
