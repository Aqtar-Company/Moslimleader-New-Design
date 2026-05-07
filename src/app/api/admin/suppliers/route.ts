export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { getAllSupplierBalances, SUPPLIER_TYPES, type SupplierType } from '@/lib/suppliers';

export async function GET() {
  const guard = await requirePerm('suppliers.read');
  if ('response' in guard) return guard.response;

  const [suppliers, balances] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { transactions: true, batches: true } } },
    }),
    getAllSupplierBalances(),
  ]);

  return NextResponse.json({
    suppliers: suppliers.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      contactPhone: s.contactPhone,
      contactEmail: s.contactEmail,
      notes: s.notes,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
      transactionCount: s._count.transactions,
      batchCount: s._count.batches,
      balance: balances.get(s.id) ?? 0, // positive = we owe them
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requirePerm('suppliers.write');
  if ('response' in guard) return guard.response;

  let body: { name?: string; type?: string; contactPhone?: string; contactEmail?: string; notes?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
  const type = (SUPPLIER_TYPES as readonly string[]).includes(body.type ?? '') ? (body.type as SupplierType) : 'other';

  try {
    const created = await prisma.supplier.create({
      data: {
        name, type,
        contactPhone: body.contactPhone?.trim() || null,
        contactEmail: body.contactEmail?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });
    await logActionSafe({
      actor: guard.user, action: 'supplier.create', entity: 'Supplier', entityId: created.id,
      after: created,
    });
    return NextResponse.json({ ok: true, supplier: created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'مورد بنفس الاسم موجود بالفعل' }, { status: 409 });
    }
    throw err;
  }
}
