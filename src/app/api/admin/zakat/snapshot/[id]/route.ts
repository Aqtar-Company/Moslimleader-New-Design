export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// GET — fetch one snapshot with its items breakdown for the
// drill-down view.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('zakat.read');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const snap = await prisma.zakatSnapshot.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!snap) return NextResponse.json({ error: 'Snapshot غير موجود' }, { status: 404 });
  return NextResponse.json({ snapshot: snap });
}

// PATCH — only payment status, payment date, and notes are mutable.
// Everything else returns 403 to preserve the audit trail.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('zakat.write');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  let body: { paymentStatus?: string; paymentDate?: string | null; notes?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (body.paymentStatus !== undefined) {
    if (!['paid', 'unpaid'].includes(body.paymentStatus)) {
      return NextResponse.json({ error: 'حالة الدفع غير صالحة' }, { status: 400 });
    }
    update.paymentStatus = body.paymentStatus;
    // Auto-stamp paymentDate when transitioning to paid (admin can
    // override via the same call by also sending paymentDate).
    if (body.paymentStatus === 'paid' && body.paymentDate === undefined) {
      update.paymentDate = new Date();
    }
    if (body.paymentStatus === 'unpaid') update.paymentDate = null;
  }
  if (body.paymentDate !== undefined) {
    update.paymentDate = body.paymentDate ? new Date(body.paymentDate) : null;
  }
  if (body.notes !== undefined) update.notes = body.notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'لا تغييرات للحفظ' }, { status: 400 });
  }

  const updated = await prisma.zakatSnapshot.update({ where: { id }, data: update });
  await logActionSafe({
    actor: guard.user, action: 'zakat.snapshot-update',
    entity: 'ZakatSnapshot', entityId: id,
    metadata: { changes: Object.keys(update) },
  });
  return NextResponse.json({ ok: true, snapshot: updated });
}
