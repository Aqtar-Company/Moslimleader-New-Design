export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { invalidateCustomersCache } from '@/lib/customers-cache';
import { CUSTOMER_TRANSACTION_KINDS, type CustomerTransactionKind, getCustomerBalance } from '@/lib/customer-receivables';

// GET — list a customer's ledger entries newest first, plus the running
// balance. Cheap query (indexed on customerId). Gated on wholesale.read
// because the ledger lives behind the new /admin/wholesale tab; the
// customers tab is back to marketing-only.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('wholesale.read');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const [transactions, balance] = await Promise.all([
    prisma.customerTransaction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    getCustomerBalance(id),
  ]);
  return NextResponse.json({ transactions, balance });
}

// POST — record a new manual transaction (invoice / payment / credit-note).
// Customer.id is verified before insert so we don't get orphan rows.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('wholesale.write');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  let body: { kind?: string; amount?: number; description?: string; orderId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  if (!(CUSTOMER_TRANSACTION_KINDS as readonly string[]).includes(body.kind ?? '')) {
    return NextResponse.json({ error: 'نوع المعاملة غير صالح' }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });
  }

  const customer = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!customer) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });

  const created = await prisma.customerTransaction.create({
    data: {
      customerId: id,
      kind: body.kind as CustomerTransactionKind,
      amount: Math.round(amount * 100) / 100,
      description: body.description?.trim() || null,
      orderId: body.orderId?.trim() || null,
      createdByUserId: guard.user.userId,
    },
  });
  // Invalidate the customers aggregate cache so the wholesale list
  // reflects the changed balance immediately.
  invalidateCustomersCache();
  await logActionSafe({
    actor: guard.user, action: 'customer.transaction-add', entity: 'CustomerTransaction', entityId: created.id,
    after: created, metadata: { customerName: customer.name },
  });
  return NextResponse.json({ ok: true, transaction: created });
}
