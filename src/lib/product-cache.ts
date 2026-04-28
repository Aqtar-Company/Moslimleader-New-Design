// Shared in-memory cache for the public products list.
// Invalidated by admin mutations (PUT/POST/DELETE on products).
export let publicProductCache: { data: unknown[]; expiresAt: number } | null = null;
export const PUBLIC_CACHE_TTL = 60_000;

export function invalidatePublicProductsCache() {
  publicProductCache = null;
}

export function setPublicProductCache(data: unknown[]) {
  publicProductCache = { data, expiresAt: Date.now() + PUBLIC_CACHE_TTL };
}
