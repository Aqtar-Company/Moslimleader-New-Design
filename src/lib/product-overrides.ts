import { prisma } from './prisma';
import { products as staticProducts } from './products';
import type { Product } from '@/types';

// The shape of an override entry inside the `product-overrides` Setting row.
// Admins edit this via /api/admin/products/[id] PUT (saves a partial Product
// + an optional `_deleted` flag and an optional regional-pricing fallback).
export type ProductOverride = Partial<Product> & {
  _deleted?: boolean;
  regionalPricing?: { price_usd_manual?: number; price_egp_manual?: number };
};

export type ProductOverridesMap = Record<string, ProductOverride>;

// Last-known good overrides cached in module memory. The cache exists so
// that when the DB blips, we can still serve the static catalogue WITH
// the admin's customisations (instead of falling back to raw statics and
// silently swapping prices). 60s TTL is a balance between freshness and
// resilience — admin edits explicitly invalidate via invalidateOverridesCache().
const OVERRIDES_TTL_MS = 60_000;
let overridesCache: { value: ProductOverridesMap; expiresAt: number; warm: boolean } | null = null;

export function invalidateOverridesCache(): void {
  overridesCache = null;
}

// Read the overrides map. On a fresh hit, queries the DB and caches the
// result. On DB failure, returns the last warm cache (even if expired)
// so the home page never silently regresses to un-customised prices.
export async function loadStaticOverrides(): Promise<ProductOverridesMap> {
  if (overridesCache && Date.now() < overridesCache.expiresAt) return overridesCache.value;
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
    const value = (row?.value ?? {}) as ProductOverridesMap;
    overridesCache = { value, expiresAt: Date.now() + OVERRIDES_TTL_MS, warm: true };
    return value;
  } catch (err) {
    console.error('[loadStaticOverrides]', err);
    if (overridesCache?.warm) return overridesCache.value; // serve stale on error
    return {};
  }
}

// Pure function: merge one static product with its override entry.
// Returns null when the override marks the product as _deleted.
// Resolves regional-pricing fallbacks when explicit price/priceUsd is missing.
export function applyOverride(product: Product, override?: ProductOverride): Product | null {
  if (!override) return product;
  if (override._deleted) return null;
  const merged = { ...product, ...override } as Product & {
    regionalPricing?: ProductOverride['regionalPricing'];
  };
  const regional = override.regionalPricing ?? merged.regionalPricing;
  // Override price wins; else regional fallback wins; else static price stays.
  const explicitPriceUsd = typeof override.priceUsd === 'number' && override.priceUsd > 0;
  if (!explicitPriceUsd && (!merged.priceUsd || merged.priceUsd === 0) && regional?.price_usd_manual) {
    merged.priceUsd = regional.price_usd_manual;
  }
  const explicitPrice = typeof override.price === 'number' && override.price > 0;
  if (!explicitPrice && regional?.price_egp_manual && regional.price_egp_manual > 0) {
    merged.price = regional.price_egp_manual;
  }
  return merged;
}

// The canonical "static catalogue with admin customisations" list.
// Drops _deleted entries.
export async function getMergedStaticProducts(): Promise<Product[]> {
  const overrides = await loadStaticOverrides();
  return staticProducts
    .map(p => applyOverride(p, overrides[p.id]))
    .filter((p): p is Product => p !== null);
}

// Single-product lookup by id or slug. Used by the per-slug detail route.
export async function getMergedStaticProduct(
  idOrSlug: string,
): Promise<Product | null> {
  const sp = staticProducts.find(p => p.id === idOrSlug || p.slug === idOrSlug);
  if (!sp) return null;
  const overrides = await loadStaticOverrides();
  return applyOverride(sp, overrides[sp.id]);
}
