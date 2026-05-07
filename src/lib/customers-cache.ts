// Module-level cache so /api/admin/customers can serve paginated re-fetches
// from one in-memory aggregation. Lives in a lib file (NOT a route module)
// because Next.js refuses non-handler exports from route.ts files.
//
// Mutators that change customer-derived fields (wholesale toggle, profile
// edits, customer deletion) call invalidateCustomersCache() so the next
// list request re-aggregates from fresh DB rows.

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  marketingOptIn: boolean;
  isWholesale: boolean;
  createdAt: string;
  orderCount: number;
  totalSpend: number;
  avgOrder: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  daysSinceLastOrder: number | null;
  productIds: string[];
  lastGovernorate: string | null;
  segments: string[];
}

export interface AggregatedCache { at: number; list: CustomerSummary[]; totalProducts: number }

export const AGG_TTL_MS = 5 * 60 * 1000;

let aggCache: AggregatedCache | null = null;

export function getCustomersCache(): AggregatedCache | null {
  if (aggCache && Date.now() - aggCache.at < AGG_TTL_MS) return aggCache;
  return null;
}

export function setCustomersCache(next: AggregatedCache): void {
  aggCache = next;
}

export function invalidateCustomersCache(): void {
  aggCache = null;
}
