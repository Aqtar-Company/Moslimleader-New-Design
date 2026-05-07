export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { SUPPLIER_TRANSACTION_KINDS, type SupplierTransactionKind } from '@/lib/suppliers';

// POST a manual transaction. Batches create their own transactions inside the
// production-batch route; this endpoint is for one-off invoices, payments,
// or refunds (credit-notes) the admin enters by hand.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('suppliers.write');
  if ('response' in guard) return guard.response;

  const { id } = await params;
  let body: { kind?: string; amount?: number; description?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  if (!(SUPPLIER_TRANSACTION_KINDS as readonly string[]).includes(body.kind ?? '')) {
    return NextResponse.json({ error: 'نوع المعاملة غير صالح' }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });

  const created = await prisma.supplierTransaction.create({
    data: {
      supplierId: id,
      kind: body.kind as SupplierTransactionKind,
      amount: Math.round(amount * 100) / 100,
      description: body.description?.trim() || null,
      createdByUserId: guard.user.userId,
    },
  });
  await logActionSafe({
    actor: guard.user, action: 'supplier.transaction-add', entity: 'SupplierTransaction', entityId: created.id,
    after: created, metadata: { supplierName: supplier.name },
  });
  return NextResponse.json({ ok: true, transaction: created });
}
