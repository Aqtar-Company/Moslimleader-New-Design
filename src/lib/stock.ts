import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

export type StockReason =
  | 'order_created'
  | 'order_cancelled'
  | 'order_uncancelled'
  | 'manual_adjustment';

export interface StockAdjustItem {
  productId: string;
  delta: number;                   // negative = decrement, positive = restore
  selectedModel?: number | null;   // variant index when applicable
  // Optional per-line overrides for the audit log; when omitted, uses the call-level defaults.
  reason?: StockReason;
  note?: string;
}

export interface StockAdjustOptions {
  reason: StockReason;
  orderId?: string | null;
  adminId?: string | null;
  /**
   * When true, throw InsufficientStockError if any decrement would push
   * stock below zero. Defaults to true for `order_created`, false for
   * restores/manual adjustments.
   */
  enforceNonNegative?: boolean;
}

export class InsufficientStockError extends Error {
  productId: string;
  available: number;
  requested: number;
  variantIndex?: number | null;
  productName?: string;
  variantName?: string;
  constructor(args: {
    productId: string;
    available: number;
    requested: number;
    variantIndex?: number | null;
    productName?: string;
    variantName?: string;
  }) {
    const where = args.variantName ? ` (موديل: ${args.variantName})` : '';
    const label = args.productName || args.productId;
    super(`المخزون غير كافٍ لـ "${label}"${where} — المتاح ${args.available}، المطلوب ${args.requested}`);
    this.name = 'InsufficientStockError';
    this.productId = args.productId;
    this.available = args.available;
    this.requested = args.requested;
    this.variantIndex = args.variantIndex ?? null;
    this.productName = args.productName;
    this.variantName = args.variantName;
  }
}

interface VariantShape { id?: string; name?: string; nameEn?: string }

// Atomic stock adjustment + audit log. Validation, Product update, and
// StockMovement insert all run inside ONE interactive Prisma transaction
// so concurrent orders cannot oversell.
export async function adjustStock(
  items: StockAdjustItem[],
  options: StockAdjustOptions,
): Promise<void> {
  if (items.length === 0) return;
  const filtered = items.filter(it => it.productId && it.delta);
  if (filtered.length === 0) return;

  // Group by productId so we lock+update each product once even if the
  // order has multiple lines for the same product (e.g. two variants).
  const byProduct = new Map<string, StockAdjustItem[]>();
  for (const it of filtered) {
    const arr = byProduct.get(it.productId) ?? [];
    arr.push(it);
    byProduct.set(it.productId, arr);
  }

  const enforce = options.enforceNonNegative ?? (options.reason === 'order_created');

  await prisma.$transaction(async tx => {
    for (const [productId, lines] of byProduct.entries()) {
      // Read current stock + variantStocks INSIDE the transaction so the
      // subsequent update is based on a fresh snapshot. MySQL's REPEATABLE
      // READ + the conditional updateMany below give us oversell-safety
      // without an explicit row lock.
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, stock: true, variantStocks: true, variants: true },
      });
      if (!product) {
        // Skip silently — caller should have validated existence already,
        // and we don't want to fail the whole order over a phantom item.
        continue;
      }

      const variantStocks = (product.variantStocks ?? null) as Record<string, number> | null;
      const variants = (product.variants ?? []) as unknown as VariantShape[];
      const hasVariants = variantStocks && Object.keys(variantStocks).length > 0;

      const totalDelta = lines.reduce((s, l) => s + l.delta, 0);
      const newStock = product.stock + totalDelta;

      // Per-variant accounting.
      const nextVariantStocks: Record<string, number> | null = hasVariants
        ? { ...(variantStocks as Record<string, number>) }
        : null;
      if (nextVariantStocks) {
        for (const l of lines) {
          if (l.selectedModel === null || l.selectedModel === undefined) continue;
          const key = String(l.selectedModel);
          const before = nextVariantStocks[key] ?? 0;
          const after = before + l.delta;
          if (enforce && after < 0) {
            throw new InsufficientStockError({
              productId,
              available: before,
              requested: Math.abs(l.delta),
              variantIndex: l.selectedModel,
              productName: product.name,
              variantName: variants[l.selectedModel]?.name,
            });
          }
          nextVariantStocks[key] = after;
        }
      }

      if (enforce && newStock < 0) {
        throw new InsufficientStockError({
          productId,
          available: product.stock,
          requested: Math.abs(totalDelta),
          productName: product.name,
        });
      }

      // Conditional update: when enforcing, we require `stock >= |delta|`.
      // updateMany returns count=0 if the row moved underneath us → throw.
      const updateData: Prisma.ProductUpdateManyMutationInput = {
        stock: newStock,
        ...(nextVariantStocks ? { variantStocks: nextVariantStocks as unknown as Prisma.InputJsonValue } : {}),
      };
      const where: Prisma.ProductWhereInput = enforce && totalDelta < 0
        ? { id: productId, stock: { gte: -totalDelta } }
        : { id: productId };
      const res = await tx.product.updateMany({ where, data: updateData });
      if (res.count === 0) {
        // Race lost — another transaction decremented this product first.
        throw new InsufficientStockError({
          productId,
          available: product.stock,
          requested: Math.abs(totalDelta),
          productName: product.name,
        });
      }

      // Movement log — one row per input line so per-variant deltas stay distinct.
      for (const l of lines) {
        const variantIndex = l.selectedModel ?? null;
        const variantBefore = nextVariantStocks && variantIndex !== null
          ? (variantStocks as Record<string, number>)[String(variantIndex)] ?? 0
          : null;
        const variantAfter = nextVariantStocks && variantIndex !== null
          ? nextVariantStocks[String(variantIndex)]
          : null;
        await tx.stockMovement.create({
          data: {
            productId,
            variantIndex,
            delta: l.delta,
            reason: l.reason ?? options.reason,
            orderId: options.orderId ?? null,
            adminId: options.adminId ?? null,
            stockBefore: product.stock,
            stockAfter: newStock,
            variantStockBefore: variantBefore,
            variantStockAfter: variantAfter,
            note: l.note ?? null,
          },
        });
      }
    }
  });
}

export function decrementsFromItems(
  items: Array<{ productId: string; quantity: number; selectedModel?: number | null }>,
): StockAdjustItem[] {
  return items.map(it => ({
    productId: it.productId,
    delta: -Math.abs(it.quantity),
    selectedModel: it.selectedModel ?? null,
  }));
}

export function restoresFromItems(
  items: Array<{ productId: string; quantity: number; selectedModel?: number | null }>,
): StockAdjustItem[] {
  return items.map(it => ({
    productId: it.productId,
    delta: Math.abs(it.quantity),
    selectedModel: it.selectedModel ?? null,
  }));
}

// Pre-flight validation for order creation flows: returns the first
// item that would oversell, or null if all are fine. Use this BEFORE
// creating the order so we can fail fast with a friendly message
// instead of letting the order partially succeed.
export async function validateStockAvailability(
  items: Array<{ productId: string; quantity: number; selectedModel?: number | null }>,
): Promise<InsufficientStockError | null> {
  if (items.length === 0) return null;
  const productIds = Array.from(new Set(items.map(it => it.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, stock: true, variantStocks: true, variants: true },
  });
  const byId = new Map(products.map(p => [p.id, p]));

  // Aggregate requested quantities per (productId, variant) so the same
  // product appearing on multiple lines is summed before comparing.
  const totalsByProduct = new Map<string, number>();
  const totalsByVariant = new Map<string, number>();
  for (const it of items) {
    totalsByProduct.set(it.productId, (totalsByProduct.get(it.productId) ?? 0) + it.quantity);
    if (it.selectedModel !== null && it.selectedModel !== undefined) {
      const key = `${it.productId}::${it.selectedModel}`;
      totalsByVariant.set(key, (totalsByVariant.get(key) ?? 0) + it.quantity);
    }
  }

  for (const [productId, requested] of totalsByProduct.entries()) {
    const p = byId.get(productId);
    if (!p) continue;
    if (p.stock < requested) {
      return new InsufficientStockError({
        productId,
        available: p.stock,
        requested,
        productName: p.name,
      });
    }
  }
  for (const [key, requested] of totalsByVariant.entries()) {
    const [productId, idxStr] = key.split('::');
    const p = byId.get(productId);
    if (!p) continue;
    const variantStocks = (p.variantStocks ?? null) as Record<string, number> | null;
    if (!variantStocks || Object.keys(variantStocks).length === 0) continue;
    const available = variantStocks[idxStr] ?? 0;
    if (available < requested) {
      const variants = (p.variants ?? []) as unknown as VariantShape[];
      return new InsufficientStockError({
        productId,
        available,
        requested,
        variantIndex: parseInt(idxStr, 10),
        productName: p.name,
        variantName: variants[parseInt(idxStr, 10)]?.name,
      });
    }
  }
  return null;
}
