export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { getValuationAssumptions } from '@/lib/valuation-assumptions';

interface VariantShape { name?: string }

// GET /api/admin/production/seed-stock — return one row per (product, variant)
// with the data the wizard needs to reason about coverage:
//   currentStock        — Product.stock (or variantStocks[idx])
//   batchedQuantity     — SUM of ProductionBatch.quantity for that scope
//   uncoveredQuantity   — currentStock - batchedQuantity (clamped at 0)
//   alreadySeeded       — any ProductionBatch with isOpeningBalance=true exists
//   suggestedUnitCost   — productPrice × cogsRatio (the heuristic) for the
//                         input default, so the user can usually just confirm.
export async function GET() {
  const guard = await requirePerm('production.write');
  if ('response' in guard) return guard.response;

  const assumptions = await getValuationAssumptions();
  const cogs = assumptions.cogsRatio;

  const [products, batchAgg, seedFlags, soldAgg] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, slug: true, price: true, stock: true, variantStocks: true, variants: true },
      orderBy: { name: 'asc' },
    }),
    prisma.productionBatch.groupBy({
      by: ['productId', 'variantIndex'],
      _sum: { quantity: true },
    }),
    prisma.productionBatch.findMany({
      where: { isOpeningBalance: true },
      select: { productId: true, variantIndex: true },
    }),
    // Lifetime sold per (product, variant). We need this so a product
    // that's stock=0 today but had historical sales (and zero batches)
    // still surfaces — its cost basis matters for COGS even though
    // there's nothing left to sell.
    prisma.orderItem.groupBy({
      by: ['productId', 'selectedModel'],
      where: { order: { status: { not: 'cancelled' }, paymentMethod: { not: 'gift' } } },
      _sum: { quantity: true },
    }),
  ]);

  // Build lookup maps once so the row builder below stays cheap.
  const batchedKey = (productId: string, variantIndex: number | null) =>
    `${productId}::${variantIndex === null ? '_' : variantIndex}`;
  const batchedMap = new Map<string, number>();
  for (const b of batchAgg) {
    batchedMap.set(batchedKey(b.productId, b.variantIndex), Number(b._sum.quantity ?? 0));
  }
  const seededSet = new Set<string>(seedFlags.map(s => batchedKey(s.productId, s.variantIndex)));
  const soldMap = new Map<string, number>();
  for (const s of soldAgg) {
    soldMap.set(batchedKey(s.productId, s.selectedModel), Number(s._sum.quantity ?? 0));
  }

  const rows: Array<{
    productId: string; productName: string; productSlug: string; productPrice: number;
    variantIndex: number | null; variantName: string | null;
    currentStock: number; soldUnits: number; batchedQuantity: number; uncoveredQuantity: number;
    alreadySeeded: boolean; suggestedUnitCost: number;
  }> = [];

  for (const p of products) {
    const variants = (p.variants ?? []) as unknown as VariantShape[];
    const hasVariants = Array.isArray(variants) && variants.length > 0;
    const suggested = Math.round(p.price * cogs * 100) / 100;

    if (hasVariants) {
      // Emit one row per variant. Skip ONLY when the variant has zero
      // stock AND zero historical sales — nothing to price.
      const variantStocks = (p.variantStocks ?? {}) as Record<string, number>;
      for (let idx = 0; idx < variants.length; idx++) {
        const stock = variantStocks[String(idx)] ?? 0;
        const sold = soldMap.get(batchedKey(p.id, idx)) ?? 0;
        const accountable = stock + sold;
        if (accountable <= 0) continue;
        const batched = batchedMap.get(batchedKey(p.id, idx)) ?? 0;
        rows.push({
          productId: p.id, productName: p.name, productSlug: p.slug, productPrice: p.price,
          variantIndex: idx, variantName: variants[idx]?.name ?? `موديل ${idx + 1}`,
          currentStock: stock, soldUnits: sold, batchedQuantity: batched,
          uncoveredQuantity: Math.max(0, accountable - batched),
          alreadySeeded: seededSet.has(batchedKey(p.id, idx)),
          suggestedUnitCost: suggested,
        });
      }
    } else {
      const sold = soldMap.get(batchedKey(p.id, null)) ?? 0;
      const accountable = p.stock + sold;
      if (accountable <= 0) continue;
      const batched = batchedMap.get(batchedKey(p.id, null)) ?? 0;
      rows.push({
        productId: p.id, productName: p.name, productSlug: p.slug, productPrice: p.price,
        variantIndex: null, variantName: null,
        currentStock: p.stock, soldUnits: sold, batchedQuantity: batched,
        uncoveredQuantity: Math.max(0, accountable - batched),
        alreadySeeded: seededSet.has(batchedKey(p.id, null)),
        suggestedUnitCost: suggested,
      });
    }
  }

  return NextResponse.json({ rows });
}

// POST — bulk-create opening-balance batches. NO stock change, NO supplier
// ledger entries. Quantity is re-validated against the current uncovered
// amount in the same transaction so two admins running the wizard at the
// same time don't double-seed.
export async function POST(req: NextRequest) {
  const guard = await requirePerm('production.write');
  if ('response' in guard) return guard.response;

  let body: {
    entries?: Array<{ productId: string; variantIndex: number | null; quantity: number; unitCost: number; notes?: string }>;
    batchDate?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: 'لا توجد إدخالات' }, { status: 400 });
  }

  // Default batchDate to a year ago — clearly historical, but keeps timezone
  // hops stable (parsing same-day from the client).
  const batchDate = body.batchDate ? new Date(body.batchDate) : (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d;
  })();
  if (Number.isNaN(batchDate.getTime())) {
    return NextResponse.json({ error: 'تاريخ غير صحيح' }, { status: 400 });
  }

  const result = await prisma.$transaction(async tx => {
    const created: string[] = [];
    const errors: Array<{ productId: string; variantIndex: number | null; error: string }> = [];

    for (const entry of body.entries!) {
      const productId = String(entry.productId ?? '');
      const variantIndex = typeof entry.variantIndex === 'number' ? entry.variantIndex : null;
      const quantity = Math.floor(Number(entry.quantity));
      const unitCost = Number(entry.unitCost);

      if (!productId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        errors.push({ productId, variantIndex, error: 'بيانات غير صحيحة' });
        continue;
      }

      // Re-validate uncovered quantity now (might have changed since the
      // wizard loaded). If the user requested more than what's actually
      // uncovered, fail the row but keep the rest of the batch going.
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, stock: true, variantStocks: true },
      });
      if (!product) { errors.push({ productId, variantIndex, error: 'المنتج غير موجود' }); continue; }

      const currentStock = variantIndex === null
        ? product.stock
        : ((product.variantStocks as Record<string, number> | null)?.[String(variantIndex)] ?? 0);

      const [batchedAgg, soldAgg] = await Promise.all([
        tx.productionBatch.aggregate({
          where: { productId, variantIndex },
          _sum: { quantity: true },
        }),
        // Re-read sold quantity inside the transaction so concurrent
        // orders changing the count are reflected in the validation.
        tx.orderItem.aggregate({
          where: {
            productId, selectedModel: variantIndex,
            order: { status: { not: 'cancelled' }, paymentMethod: { not: 'gift' } },
          },
          _sum: { quantity: true },
        }),
      ]);
      const batched = Number(batchedAgg._sum.quantity ?? 0);
      const sold = Number(soldAgg._sum.quantity ?? 0);
      // Total units that need a cost basis = current stock + everything
      // ever sold (which left the warehouse but had a cost too).
      const uncovered = Math.max(0, currentStock + sold - batched);

      if (quantity > uncovered) {
        errors.push({
          productId, variantIndex,
          error: `الكمية ${quantity} أكبر من المتاح للتسعير ${uncovered}. أعد تحميل الصفحة.`,
        });
        continue;
      }

      // Idempotency: refuse to seed twice for the same scope. The wizard's
      // GET marks already-seeded rows so the UI auto-skips them, but a user
      // could still un-skip; this is the server-side guard.
      const existingSeed = await tx.productionBatch.findFirst({
        where: { productId, variantIndex, isOpeningBalance: true },
        select: { id: true },
      });
      if (existingSeed) {
        errors.push({
          productId, variantIndex,
          error: 'هذا المنتج تم تسعيره افتتاحياً سابقاً. لإعادة التسعير سجّل باتش عادي بقيمة سالبة.',
        });
        continue;
      }

      const totalCost = Math.round(quantity * unitCost * 100) / 100;
      const batch = await tx.productionBatch.create({
        data: {
          productId, variantIndex,
          quantity, unitCost, totalCost,
          batchDate,
          notes: entry.notes?.trim() || 'افتتاحية مخزون قديم',
          isOpeningBalance: true,
          createdByUserId: guard.user.userId,
        },
      });

      // Stock-movement row with delta=0 so the audit trail records WHEN the
      // opening cost was registered without faking a stock change.
      await tx.stockMovement.create({
        data: {
          productId, variantIndex,
          delta: 0, reason: 'opening_balance_seed',
          adminId: guard.user.userId,
          stockBefore: currentStock, stockAfter: currentStock,
          variantStockBefore: variantIndex !== null ? currentStock : null,
          variantStockAfter:  variantIndex !== null ? currentStock : null,
          note: `Opening balance batch ${batch.id}`,
        },
      });

      created.push(batch.id);
    }

    return { created, errors };
  }, { timeout: 30000 });

  await logActionSafe({
    actor: guard.user, action: 'production.batch-create',
    entity: 'ProductionBatch', entityId: result.created[0] ?? null,
    metadata: { isOpeningBalance: true, createdCount: result.created.length, errorCount: result.errors.length },
  });

  return NextResponse.json({ ok: true, created: result.created.length, skipped: result.errors.length, errors: result.errors });
}
