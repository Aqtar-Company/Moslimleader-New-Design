import { invalidateOverridesCache } from './product-overrides';

// 60s in-memory cache for the admin products grid + pricing table.
// Admin writes (POST/PUT/DELETE on products) invalidate via the helper
// below. Lives in lib (not in a route.ts) so non-route callers can
// invalidate it without violating Next.js's route-file export rules.
let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export function getAdminProductsCache(): unknown | null {
  if (cache && Date.now() < cache.expiresAt) return cache.data;
  return null;
}

export function setAdminProductsCache(data: unknown): void {
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
}

// Bust both this cache AND the static-product overrides cache, since
// any admin product write may affect overrides too.
export function invalidateAdminProductsCache(): void {
  cache = null;
  invalidateOverridesCache();
}
