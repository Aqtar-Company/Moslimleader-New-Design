export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

interface VariantShape { name?: string }

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requirePerm('production.write');
  if ('response' in guard) return guard.response;

  let body: {
    quantity?: number;
    unitCost?: number;
    supplierId?: string | null;
    batchDate?: string;
    notes?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const newQty = typeof body.quantity === 'number' ? Math.floor(body.quantity) : undefined;
  const newUnitCost = typeof body.unitCost === 'number' ? body.unitCost : undefined;

  if (newQty !== undefined && (!Number.isFinite(newQty) || newQty <= 0)) {
    return NextResponse.json({ error: 'الكمية يجب أن تكون أكبر من صفر' }, { status: 400 });
  }
  if (newUnitCost !== undefined && (!Number.isFinite(newUnitCost) || newUnitCost < 0)) {
    return NextResponse.json({ error: 'تكلفة الوحدة غير صحيحة' }, { status: 400 });
  }

  const batchId = params.id;

  const result = await prisma.$transaction(async tx => {
    const old = await tx.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        product: { select: { id: true, name: true, stock: true, variantStocks: true, variants: true } },
      },
    });
    if (!old) return null;

    const finalQty = newQty ?? old.quantity;
    const finalUnitCost = newUnitCost ?? old.unitCost;
    const finalTotalCost = Math.round(finalQty * finalUnitCost * 100) / 100;
    const finalSupplierId = body.supplierId !== undefined ? (body.supplierId || null) : old.supplierId;
    const finalBatchDate = body.batchDate ? new Date(body.batchDate) : old.batchDate;
    const finalNotes = body.notes !== undefined ? (body.notes.trim() || null) : old.notes;

    // 1. Stock adjustment when quantity changed
    if (newQty !== undefined && newQty !== old.quantity) {
      const delta = newQty - old.quantity;
      const product = old.product;
      let newStock = product.stock;
      let newVariantStocks: Record<string, number> | null = null;
      const stockBefore = product.stock;
      let stockAfter = product.stock;
      let variantStockBefore: number | null = null;
      let variantStockAfter: number | null = null;

      if (old.variantIndex !== null) {
        const cur = (product.variantStocks ?? {}) as Record<string, number>;
        const key = String(old.variantIndex);
        variantStockBefore = cur[key] ?? 0;
        variantStockAfter = Math.max(0, variantStockBefore + delta);
        newVariantStocks = { ...cur, [key]: variantStockAfter };
        newStock = Object.values(newVariantStocks).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
        stockAfter = newStock;
      } else {
        newStock = Math.max(0, product.stock + delta);
        stockAfter = newStock;
      }

      await tx.product.update({
        where: { id: product.id },
        data: {
          stock: newStock,
          ...(newVariantStocks !== null && { variantStocks: newVariantStocks }),
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          variantIndex: old.variantIndex,
          delta,
          reason: 'batch_updated',
          adminId: guard.user.userId,
          stockBefore,
          stockAfter,
          variantStockBefore,
          variantStockAfter,
          note: `Batch ${batchId} edited`,
        },
      });
    }

    // 2. Supplier ledger: replace linked transaction when supplier or cost changed
    const supplierChanged = finalSupplierId !== old.supplierId;
    const costChanged = finalTotalCost !== old.totalCost;
    if (supplierChanged || costChanged) {
      await tx.supplierTransaction.deleteMany({ where: { productionBatchId: batchId } });
      if (finalSupplierId) {
        const variants = (old.product.variants ?? []) as unknown as VariantShape[];
        void variants; // used for type narrowing only
        const variantLabel = old.variantIndex !== null ? ` — موديل ${old.variantIndex + 1}` : '';
        await tx.supplierTransaction.create({
          data: {
            supplierId: finalSupplierId,
            kind: 'invoice',
            amount: finalTotalCost,
            description: `${old.product.name}${variantLabel} × ${finalQty}`,
            productionBatchId: batchId,
            createdByUserId: guard.user.userId,
          },
        });
      }
    }

    // 3. Update the batch record
    const updated = await tx.productionBatch.update({
      where: { id: batchId },
      data: {
        quantity: finalQty,
        unitCost: finalUnitCost,
        totalCost: finalTotalCost,
        supplierId: finalSupplierId,
        batchDate: finalBatchDate,
        notes: finalNotes,
      },
    });

    return updated;
  });

  if (!result) return NextResponse.json({ error: 'الباتش غير موجود' }, { status: 404 });

  await logActionSafe({
    actor: guard.user, action: 'production.batch-update',
    entity: 'ProductionBatch', entityId: batchId,
    after: result,
  });

  return NextResponse.json({ ok: true, batch: result });
}
