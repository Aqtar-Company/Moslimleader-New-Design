export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { logActionSafe } from '@/lib/audit-log';
import { BROADCAST_LIST_SELECT, queueBroadcast, runBroadcast } from '@/lib/admin-broadcast';

async function requireAdmin() {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  return user;
}

// POST /api/admin/tareeq/broadcasts/[id]/send — start delivering a draft.
// Also the RESUME action: a broadcast that stopped half-way (process restart, SMTP outage)
// has `queued` recipient rows left, and this queues the newcomers and continues from there.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.adminBroadcast.findUnique({ where: { id: params.id }, select: { status: true, kind: true, audience: true, title: true } });
  if (!existing) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
  const resuming = existing.status !== 'draft';

  try {
    const queued = await queueBroadcast(params.id);
    void runBroadcast(params.id);
    await logActionSafe({
      actor: admin,
      action: resuming ? 'tareeq.broadcast.resume' : 'tareeq.broadcast.send',
      entity: 'AdminBroadcast',
      entityId: params.id,
      metadata: { kind: existing.kind, audience: existing.audience, title: existing.title, queued },
    });
    const broadcast = await prisma.adminBroadcast.findUnique({ where: { id: params.id }, select: BROADCAST_LIST_SELECT });
    return NextResponse.json({ broadcast, queued });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'تعذّر بدء الإرسال' }, { status: 400 });
  }
}
