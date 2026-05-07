export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

interface VariantShape { name?: string }

// GET /api/admin/production/batches?productId=&supplierId=
export async function GET(req: NextRequest) {
  const guard = await requirePerm('production.read');
  if ('response' in guard) return guard.response;

  const url = new URL(req.url);
  const productId = url.searchParams.get('productId') || undefined;
  const supplierId = url.searchParams.get('supplierId') || undefined;

  const batches = await prisma.productionBatch.findMany({
    where: { ...(productId && { productId }), ...(supplierId && { supplierId }) },
    orderBy: { batchDate: 'desc' },
    take: 500,
    include: {
      product:  { select: { id: true, name: true, slug: true, variants: true } },
      supplier: { select: { id: true, name: true, type: true } },
    },
  });

  return NextResponse.json({
    batches: batches.map(b => {
      const variants = (b.product.variants ?? []) as unknown as VariantShape[];
      const variantName = b.variantIndex !== null && b.variantIndex !== undefined
        ? variants[b.variantIndex]?.name ?? `موديل ${b.variantIndex + 1}`
        : null;
      return {
        id: b.id,
        productId: b.productId,
        productName: b.product.name,
        productSlug: b.product.slug,
        variantIndex: b.variantIndex,
        variantName,
        supplierId: b.supplierId,
        supplierName: b.supplier?.name ?? null,
        supplierType: b.supplier?.type ?? null,
        quantity: b.quantity,
        unitCost: b.unitCost,
        totalCost: b.totalCost,
        batchDate: b.batchDate.toISOString(),
        notes: b.notes,
        createdAt: b.createdAt.toISOString(),
      };
    }),
  });
}

// POST — register a new production batch. Atomically:
//   1. create the ProductionBatch row
//   2. increment Product.stock (or variantStocks[idx])
//   3. write a StockMovement (reason='batch_created')
//   4. if a supplier was picked, write a SupplierTransaction
//      (kind='invoice', productionBatchId=batch.id) so the supplier
//      balance reflects the new debt automatically.
// All four happen in one prisma.$transaction so the system can never end
// up with stock that came from a non-existent batch (or vice versa).
export async function POST(req: NextRequest) {
  const guard = await requirePerm('production.write');
  if ('response' in guard) return guard.response;

  let body: {
    productId?: string;
    supplierId?: string | null;
    variantIndex?: number | null;
    quantity?: number;
    unitCost?: number;
    batchDate?: string;
    notes?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const productId = String(body.productId ?? '');
  const quantity = Math.floor(Number(body.quantity));
  const unitCost = Number(body.unitCost);
  if (!productId) return NextResponse.json({ error: 'المنتج مطلوب' }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) return NextResponse.json({ error: 'الكمية يجب أن تكون أكبر من صفر' }, { status: 400 });
  if (!Number.isFinite(unitCost) || unitCost < 0) return NextResponse.json({ error: 'تكلفة الوحدة غير صحيحة' }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });

  const variants = (product.variants ?? []) as unknown as VariantShape[];
  const hasVariants = Array.isArray(variants) && variants.length > 0;
  const variantIndex = typeof body.variantIndex === 'number' ? body.variantIndex : null;
  if (hasVariants && variantIndex === null) {
    return NextResponse.json({ error: 'هذا المنتج له موديلات — اختر الموديل' }, { status: 400 });
  }
  if (variantIndex !== null && hasVariants && (variantIndex < 0 || variantIndex >= variants.length)) {
    return NextResponse.json({ error: 'موديل غير صحيح' }, { status: 400 });
  }

  const totalCost = Math.round(quantity * unitCost * 100) / 100;
  const batchDate = body.batchDate ? new Date(body.batchDate) : new Date();
  const supplierId = body.supplierId || null;

  if (supplierId) {
    const s = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!s) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
  }

  const result = await prisma.$transaction(async tx => {
    // Increment stock — either at the variant level or the top-level
    // depending on whether the product has variants.
    let newStock = product.stock;
    let newVariantStocks: Record<string, number> | null = null;
    let stockBefore = product.stock;
    let stockAfter = product.stock;
    let variantStockBefore: number | null = null;
    let variantStockAfter: number | null = null;

    if (variantIndex !== null) {
      const cur = (product.variantStocks ?? {}) as Record<string, number>;
      const key = String(variantIndex);
      variantStockBefore = cur[key] ?? 0;
      variantStockAfter = variantStockBefore + quantity;
      newVariantStocks = { ...cur, [key]: variantStockAfter };
      // Total stock = sum of variants so the headline number stays honest.
      newStock = Object.values(newVariantStocks).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
      stockAfter = newStock;
    } else {
      newStock = product.stock + quantity;
      stockAfter = newStock;
    }

    await tx.product.update({
      where: { id: productId },
      data: {
        stock: newStock,
        ...(newVariantStocks !== null && { variantStocks: newVariantStocks }),
        // A batch always implies the product is now in stock.
        inStock: true,
      },
    });

    const batch = await tx.productionBatch.create({
      data: {
        productId, supplierId, variantIndex,
        quantity, unitCost, totalCost,
        batchDate,
        notes: body.notes?.trim() || null,
        createdByUserId: guard.user.userId,
      },
    });

    await tx.stockMovement.create({
      data: {
        productId, variantIndex,
        delta: quantity, reason: 'batch_created',
        adminId: guard.user.userId,
        stockBefore, stockAfter,
        variantStockBefore, variantStockAfter,
        note: `Batch ${batch.id}`,
      },
    });

    let txnId: string | null = null;
    if (supplierId) {
      const txn = await tx.supplierTransaction.create({
        data: {
          supplierId,
          kind: 'invoice',
          amount: totalCost,
          description: `${product.name}${variantIndex !== null ? ` — موديل ${variantIndex + 1}` : ''} × ${quantity}`,
          productionBatchId: batch.id,
          createdByUserId: guard.user.userId,
        },
      });
      txnId = txn.id;
    }

    return { batch, txnId };
  });

  await logActionSafe({
    actor: guard.user, action: 'production.batch-create',
    entity: 'ProductionBatch', entityId: result.batch.id,
    after: result.batch,
    metadata: { productName: product.name, supplierTransactionId: result.txnId },
  });

  return NextResponse.json({ ok: true, batch: result.batch });
}
