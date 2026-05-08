import { prisma } from './prisma';
import { getValuationAssumptions } from './valuation-assumptions';

// Royalty / IP aggregator. For each active agreement, compute the TTM
// gross profit of the listed products and multiply by the agreed
// percentage. The total of these accruals is treated as a short-term
// liability in the valuation report (subtracts from baseValue) until
// the owner records a manual lastPaidAt.

export interface RoyaltyAgreementWithAccrual {
  id: string;
  payeeName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  percentage: number;
  productIds: string[];
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  lastPaidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // computed
  ttmGrossProfit: number;        // EGP across the agreement's products
  amountAccrued: number;         // ttmGrossProfit × percentage / 100
  productNames: Array<{ id: string; name: string }>;
}

export interface RoyaltySummary {
  agreementsTotal: number;
  agreementsActive: number;
  totalAccrued: number;          // EGP across active agreements
  avgPercentage: number;         // mean across active agreements
  totalGrossProfitEligible: number;
}

const TTM_MS = 365 * 86400000;

// Round a money figure to 2dp at the boundary.
const round2 = (n: number) => Math.round(n * 100) / 100;

function parseProductIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

export async function getRoyaltiesReport(): Promise<{
  agreements: RoyaltyAgreementWithAccrual[];
  summary: RoyaltySummary;
}> {
  const assumptions = await getValuationAssumptions();
  const cogsRatio = assumptions.cogsRatio;

  const agreements = await prisma.royaltyAgreement.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });

  // Collect every product id referenced anywhere so we batch-fetch
  // names + costs in a single round-trip.
  const allProductIds = new Set<string>();
  for (const a of agreements) {
    for (const id of parseProductIds(a.productIds)) allProductIds.add(id);
  }
  const productIdList = Array.from(allProductIds);

  const products = productIdList.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIdList } },
        select: { id: true, name: true },
      })
    : [];
  const productNameMap = new Map(products.map(p => [p.id, p.name]));

  // Weighted-avg cost per referenced product, computed from production
  // batches (same logic the valuation route uses). Products without
  // batches fall back to retail × cogsRatio in the per-line math below.
  const batchAgg = productIdList.length > 0
    ? await prisma.productionBatch.groupBy({
        by: ['productId'],
        where: { productId: { in: productIdList } },
        _sum: { quantity: true, totalCost: true },
      })
    : [];
  const avgCostByProduct = new Map<string, number>();
  for (const b of batchAgg) {
    const q = Number(b._sum.quantity ?? 0);
    const c = Number(b._sum.totalCost ?? 0);
    if (q > 0) avgCostByProduct.set(b.productId, c / q);
  }

  // Pull all order items for referenced products in the TTM window in
  // a single query — cheaper than per-agreement lookups when the same
  // product appears in multiple agreements.
  const since = new Date(Date.now() - TTM_MS);
  const ttmItems = productIdList.length > 0
    ? await prisma.orderItem.findMany({
        where: {
          productId: { in: productIdList },
          order: {
            status: { not: 'cancelled' },
            paymentMethod: { not: 'gift' },
            createdAt: { gte: since },
          },
        },
        select: { productId: true, quantity: true, unitPrice: true },
      })
    : [];

  // Aggregate per-product TTM gross profit so each agreement just
  // sums over its products.
  const grossProfitByProduct = new Map<string, number>();
  for (const it of ttmItems) {
    const lineRevenue = it.unitPrice * it.quantity;
    const avg = avgCostByProduct.get(it.productId);
    const lineCost = avg !== undefined && avg > 0
      ? avg * it.quantity
      : lineRevenue * cogsRatio;
    const line = lineRevenue - lineCost;
    grossProfitByProduct.set(
      it.productId,
      (grossProfitByProduct.get(it.productId) ?? 0) + line,
    );
  }

  const enriched: RoyaltyAgreementWithAccrual[] = agreements.map(a => {
    const ids = parseProductIds(a.productIds);
    const ttmGrossProfit = ids.reduce(
      (s, id) => s + (grossProfitByProduct.get(id) ?? 0),
      0,
    );
    const amountAccrued = ttmGrossProfit * (a.percentage / 100);
    return {
      id: a.id,
      payeeName: a.payeeName,
      contactPhone: a.contactPhone,
      contactEmail: a.contactEmail,
      percentage: a.percentage,
      productIds: ids,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate?.toISOString() ?? null,
      isActive: a.isActive,
      lastPaidAt: a.lastPaidAt?.toISOString() ?? null,
      notes: a.notes,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      ttmGrossProfit: round2(Math.max(0, ttmGrossProfit)),
      amountAccrued: round2(Math.max(0, amountAccrued)),
      productNames: ids.map(id => ({
        id,
        name: productNameMap.get(id) ?? '— محذوف —',
      })),
    };
  });

  const active = enriched.filter(a => a.isActive);
  const totalAccrued = active.reduce((s, a) => s + a.amountAccrued, 0);
  const avgPercentage = active.length > 0
    ? active.reduce((s, a) => s + a.percentage, 0) / active.length
    : 0;
  const totalGrossProfitEligible = active.reduce(
    (s, a) => s + a.ttmGrossProfit,
    0,
  );

  return {
    agreements: enriched,
    summary: {
      agreementsTotal: agreements.length,
      agreementsActive: active.length,
      totalAccrued: round2(totalAccrued),
      avgPercentage: Math.round(avgPercentage * 100) / 100,
      totalGrossProfitEligible: round2(totalGrossProfitEligible),
    },
  };
}

// Lightweight version for the valuation route — only the figures it
// needs to subtract from baseValue and surface a small KPI strip.
export async function getRoyaltyAccrualSummary(): Promise<{
  totalAccrued: number;
  agreementsActive: number;
  topAccruals: Array<{ payeeName: string; amountAccrued: number }>;
}> {
  const { agreements, summary } = await getRoyaltiesReport();
  const top = agreements
    .filter(a => a.isActive && a.amountAccrued > 0)
    .sort((a, b) => b.amountAccrued - a.amountAccrued)
    .slice(0, 5)
    .map(a => ({ payeeName: a.payeeName, amountAccrued: a.amountAccrued }));
  return {
    totalAccrued: summary.totalAccrued,
    agreementsActive: summary.agreementsActive,
    topAccruals: top,
  };
}

// Context-passing version used by the valuation route. The route
// already loads `ttmItems` (TTM OrderItem rows) and `avgCostByProduct`
// (per-product weighted-avg cost from production batches); passing
// them in lets us compute royalty accruals WITHOUT re-querying the
// database. Same gross-profit definition the route uses for
// ttmGrossProfit, so the two figures stay consistent.
//
// The route also provides the active agreements list (lightweight
// select) so this helper is purely synchronous.
export interface RoyaltyContextInput {
  ttmItems: Array<{ productId: string; quantity: number; unitPrice: number }>;
  avgCostByProduct: Map<string, number>;
  cogsRatio: number;
  agreements: Array<{
    id: string;
    payeeName: string;
    percentage: number;
    productIds: unknown;
  }>;
}

export function getRoyaltyAccrualFromContext(input: RoyaltyContextInput): {
  totalAccrued: number;
  agreementsActive: number;
  topAccruals: Array<{ payeeName: string; amountAccrued: number }>;
} {
  // Per-product TTM gross profit, computed once across all items.
  const grossProfitByProduct = new Map<string, number>();
  for (const it of input.ttmItems) {
    const lineRevenue = it.unitPrice * it.quantity;
    const avg = input.avgCostByProduct.get(it.productId);
    const lineCost = avg !== undefined && avg > 0
      ? avg * it.quantity
      : lineRevenue * input.cogsRatio;
    const line = lineRevenue - lineCost;
    grossProfitByProduct.set(
      it.productId,
      (grossProfitByProduct.get(it.productId) ?? 0) + line,
    );
  }

  const enriched = input.agreements.map(a => {
    const ids = Array.isArray(a.productIds)
      ? (a.productIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    const ttmGp = ids.reduce(
      (s, id) => s + (grossProfitByProduct.get(id) ?? 0),
      0,
    );
    const amountAccrued = Math.max(0, ttmGp * (a.percentage / 100));
    return { payeeName: a.payeeName, amountAccrued: round2(amountAccrued) };
  });

  const totalAccrued = enriched.reduce((s, a) => s + a.amountAccrued, 0);
  const top = enriched
    .filter(a => a.amountAccrued > 0)
    .sort((a, b) => b.amountAccrued - a.amountAccrued)
    .slice(0, 5);

  return {
    totalAccrued: round2(totalAccrued),
    agreementsActive: input.agreements.length,
    topAccruals: top,
  };
}
