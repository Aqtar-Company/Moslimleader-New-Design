export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { invalidateCustomersCache } from '@/lib/customers-cache';

// DELETE — remove a single transaction. Customer balance recomputes
// automatically on next read since it's not stored.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; txnId: string }> }) {
  const guard = await requirePerm('customers.write');
  if ('response' in guard) return guard.response;
  const { id, txnId } = await params;

  const existing = await prisma.customerTransaction.findUnique({ where: { id: txnId } });
  if (!existing || existing.customerId !== id) {
    return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 });
  }

  await prisma.customerTransaction.delete({ where: { id: txnId } });
  invalidateCustomersCache();
  await logActionSafe({
    actor: guard.user, action: 'customer.transaction-delete',
    entity: 'CustomerTransaction', entityId: txnId,
    before: existing,
  });
  return NextResponse.json({ ok: true });
}
