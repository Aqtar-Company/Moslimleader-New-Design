export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// Delete a manually-entered supplier transaction. Batch-linked transactions
// are protected — they must be reversed by editing the batch instead so the
// stock + ledger stay in sync.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; txnId: string }> }) {
  const guard = await requirePerm('suppliers.write');
  if ('response' in guard) return guard.response;

  const { id, txnId } = await params;
  const txn = await prisma.supplierTransaction.findUnique({ where: { id: txnId } });
  if (!txn || txn.supplierId !== id) {
    return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 });
  }
  if (txn.productionBatchId) {
    return NextResponse.json({
      error: 'هذه معاملة مرتبطة بباتش — يجب تعديل الباتش بدلًا من حذف المعاملة.',
    }, { status: 409 });
  }

  await prisma.supplierTransaction.delete({ where: { id: txnId } });
  await logActionSafe({
    actor: guard.user, action: 'supplier.transaction-delete',
    entity: 'SupplierTransaction', entityId: txnId, before: txn,
  });
  return NextResponse.json({ ok: true });
}
