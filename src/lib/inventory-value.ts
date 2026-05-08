import { prisma } from './prisma';

// Single source of truth for "what does the company's inventory currently
// hold, and what is it worth at retail?"
//
// Every screen that shows an "inventory value" number — /admin/inventory,
// /admin/valuation, /admin/zakat — pulls from this helper so the figures
// can never drift apart between pages. Without this, three slightly
// different formulas existed and the owner couldn't reconcile them.
//
// The canonical definition:
//   - effectiveStock(p) = Σ variantStocks if the product carries
//     variants, else p.stock. Negative numbers are floored to 0
//     (a negative on-hand count is data corruption, not a real
//     liability — we don't want it depressing the value figure).
//   - retail value     = Σ effectiveStock(p) × p.price
//   - units            = Σ effectiveStock(p)
//
// Variant-aware on purpose: even though `Product.stock` is supposed to be
// kept in sync with `Σ variantStocks`, we treat the variant map as the
// authoritative number when it exists. This makes the helper resilient to
// any past or future drift between the two stored fields.

export interface ProductStockShape {
  stock: number;
  variantStocks: unknown; // Json column — may be null, an object, or stale data
}

export function effectiveStock(p: ProductStockShape): number {
  if (p.variantStocks && typeof p.variantStocks === 'object' && !Array.isArray(p.variantStocks)) {
    const map = p.variantStocks as Record<string, unknown>;
    const keys = Object.keys(map);
    if (keys.length > 0) {
      let sum = 0;
      for (const k of keys) {
        const v = Number(map[k]);
        if (Number.isFinite(v)) sum += v;
      }
      return Math.max(0, sum);
    }
  }
  return Math.max(0, Number(p.stock) || 0);
}

export interface InventoryValueSummary {
  units: number;            // total physical units across all products
  valueRetail: number;       // Σ units × retail price
  productsCount: number;     // total number of product rows
  inStockProductCount: number; // products with effectiveStock > 0
}

// Pulls from DB directly. Cheap query (we already select these columns
// across the codebase). Returns rounded values so display logic is
// kept simple downstream.
export async function getInventoryValueSummary(): Promise<InventoryValueSummary> {
  const products = await prisma.product.findMany({
    select: { id: true, price: true, stock: true, variantStocks: true },
  });
  let units = 0;
  let valueRetail = 0;
  let inStock = 0;
  for (const p of products) {
    const eff = effectiveStock(p);
    units += eff;
    valueRetail += eff * p.price;
    if (eff > 0) inStock++;
  }
  return {
    units: Math.round(units),
    valueRetail: Math.round(valueRetail),
    productsCount: products.length,
    inStockProductCount: inStock,
  };
}
