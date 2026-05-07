export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { getSupplierBalance, SUPPLIER_TYPES, type SupplierType } from '@/lib/suppliers';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('suppliers.read');
  if ('response' in guard) return guard.response;

  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      transactions: { orderBy: { createdAt: 'desc' }, take: 200 },
    },
  });
  if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });

  const balance = await getSupplierBalance(id);

  return NextResponse.json({
    supplier: {
      ...supplier,
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
      transactions: supplier.transactions.map(t => ({
        id: t.id, kind: t.kind, amount: t.amount, description: t.description,
        productionBatchId: t.productionBatchId,
        createdAt: t.createdAt.toISOString(),
      })),
    },
    balance,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('suppliers.write');
  if ('response' in guard) return guard.response;

  const { id } = await params;
  let body: { name?: string; type?: string; contactPhone?: string; contactEmail?: string; notes?: string; isActive?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body.type === 'string' && (SUPPLIER_TYPES as readonly string[]).includes(body.type)) data.type = body.type as SupplierType;
  if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone?.trim() || null;
  if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail?.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'لا يوجد تعديل' }, { status: 400 });

  const before = await prisma.supplier.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });

  try {
    const updated = await prisma.supplier.update({ where: { id }, data });
    await logActionSafe({
      actor: guard.user, action: 'supplier.update', entity: 'Supplier', entityId: id,
      before, after: updated,
    });
    return NextResponse.json({ ok: true, supplier: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'مورد بنفس الاسم موجود بالفعل' }, { status: 409 });
    }
    throw err;
  }
}

// DELETE is hard-blocked when there are transactions OR batches. The caller
// should soft-deactivate via PUT { isActive: false } instead in that case.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('suppliers.write');
  if ('response' in guard) return guard.response;

  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { _count: { select: { transactions: true, batches: true } } },
  });
  if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
  if (supplier._count.transactions > 0 || supplier._count.batches > 0) {
    return NextResponse.json({
      error: 'لا يمكن حذف المورد لوجود معاملات أو باتشات مرتبطة. يمكنك تعطيله بدلًا من ذلك.',
    }, { status: 409 });
  }

  await prisma.supplier.delete({ where: { id } });
  await logActionSafe({ actor: guard.user, action: 'supplier.delete', entity: 'Supplier', entityId: id, before: supplier });
  return NextResponse.json({ ok: true });
}
