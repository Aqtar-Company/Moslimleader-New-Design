export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { getValuationAssumptions } from '@/lib/valuation-assumptions';
import { getAllReceivableBalances, totalReceivables } from '@/lib/customer-receivables';
import { getAllSupplierBalances } from '@/lib/suppliers';
import { getPayrollSummary } from '@/lib/team-payroll';
import { getRoyaltiesReport } from '@/lib/royalties';
import { getPartnerCapTable } from '@/lib/partners';
import { getPnlForPeriod, periodBoundaries, type PeriodKey } from '@/lib/pnl';

// /api/admin/accounting — single endpoint feeding the consolidated
// /admin/accounting dashboard. Reuses every existing aggregator so
// the displayed numbers MUST equal the same figures shown on the
// detail pages (/admin/team, /admin/ip, /admin/partners, etc.) and on
// the comprehensive /admin/valuation report.
//
// The endpoint accepts ?period=this-month|last-month|this-quarter|ytd|ttm
// (default: ttm) for the period-bound P&L block. Other figures (AR,
// AP, royalties, payroll, partners) are point-in-time and don't vary
// by period.

const VALID_PERIODS: ReadonlyArray<PeriodKey> = ['this-month', 'last-month', 'this-quarter', 'ytd', 'ttm'];
const PERIOD_LABELS: Record<PeriodKey, string> = {
  'this-month':   'هذا الشهر',
  'last-month':   'الشهر السابق',
  'this-quarter': 'الربع الحالي',
  'ytd':          'السنة حتى الآن',
  'ttm':          'آخر 12 شهر',
};

// Light per-period cache. The five buckets share data otherwise.
// 60s TTL matches the valuation cache for a consistent snapshot
// freshness across the two pages.
const CACHE_TTL_MS = 60_000;
const cache = new Map<PeriodKey, { at: number; payload: unknown }>();

export async function GET(req: NextRequest) {
  const guard = await requirePerm(['valuation.read', 'accounting.read']);
  if ('response' in guard) return guard.response;

  const url = new URL(req.url);
  const requested = url.searchParams.get('period') as PeriodKey | null;
  const period: PeriodKey = requested && VALID_PERIODS.includes(requested) ? requested : 'ttm';

  const hit = cache.get(period);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.payload);
  }

  const assumptions = await getValuationAssumptions();

  // Fire every aggregator + supporting query in parallel.
  const [
    arBalances,
    apBalances,
    arGrossTotal,
    payroll,
    royalties,
    customerNames,
    supplierNames,
    batchAgg,
    ttmRevenueAgg,
    valuationAssumptionsRow,
  ] = await Promise.all([
    getAllReceivableBalances(),
    getAllSupplierBalances(),
    totalReceivables(),
    getPayrollSummary(),
    getRoyaltiesReport(),
    // Customer + supplier names — pulled in batch for the top-N
    // tables. Filtering by id-in-set after the balance maps are
    // available means we only fetch the names we'll actually render.
    prisma.user.findMany({
      where: { role: 'customer' },
      select: { id: true, name: true, isWholesale: true },
    }),
    prisma.supplier.findMany({
      select: { id: true, name: true, type: true },
    }),
    prisma.productionBatch.groupBy({
      by: ['productId'],
      _sum: { quantity: true, totalCost: true },
    }),
    // TTM revenue (Order.total). Used to compute reconciledMid for
    // the cap-table without depending on the heavier valuation route.
    // It mirrors the same SQL the valuation report uses.
    prisma.$queryRaw<Array<{ revenue: number }>>`
      SELECT COALESCE(SUM(total), 0) AS revenue
      FROM \`Order\`
      WHERE status != 'cancelled' AND paymentMethod != 'gift'
        AND createdAt >= DATE_SUB(NOW(), INTERVAL 365 DAY)
    `,
    prisma.setting.findUnique({ where: { key: 'valuation-assumptions' } }),
  ]);

  // Build avgCostByProduct map (single source of truth for COGS).
  const avgCostByProduct = new Map<string, number>();
  for (const b of batchAgg) {
    const q = Number(b._sum.quantity ?? 0);
    const c = Number(b._sum.totalCost ?? 0);
    if (q > 0) avgCostByProduct.set(b.productId, c / q);
  }

  // Period P&L using the SAME methodology as the valuation route.
  // When period === 'ttm' the gross-profit number equals
  // metrics.financial.grossProfit on /admin/valuation (modulo the
  // TTM window definition both routes share via Date arithmetic).
  const pnl = await getPnlForPeriod(periodBoundaries(period), {
    cogsRatio: assumptions.cogsRatio,
    avgCostByProduct,
  });

  // Per-customer top-15 by net balance (positive = customer owes us).
  // Negative balances are credit notes / overpayments and are surfaced
  // in a separate bucket so the owner can chase them up.
  const customerMap = new Map(customerNames.map(c => [c.id, c]));
  const arRows = Array.from(arBalances.entries())
    .map(([id, balance]) => {
      const c = customerMap.get(id);
      return c ? { id, name: c.name, isWholesale: c.isWholesale, balance } : null;
    })
    .filter((r): r is { id: string; name: string; isWholesale: boolean; balance: number } => r !== null);
  const arOwedToUs   = arRows.filter(r => r.balance > 0).sort((a, b) => b.balance - a.balance);
  const arOwedByUs   = arRows.filter(r => r.balance < 0).sort((a, b) => a.balance - b.balance);

  // Per-supplier top-15 by net balance (positive = we owe them).
  const supplierMap = new Map(supplierNames.map(s => [s.id, s]));
  const apRows = Array.from(apBalances.entries())
    .map(([id, balance]) => {
      const s = supplierMap.get(id);
      return s ? { id, name: s.name, type: s.type, balance } : null;
    })
    .filter((r): r is { id: string; name: string; type: string; balance: number } => r !== null);
  const apOwedByUs = apRows.filter(r => r.balance > 0).sort((a, b) => b.balance - a.balance);
  const apOwedToUs = apRows.filter(r => r.balance < 0).sort((a, b) => a.balance - b.balance);

  // Bad-debt provision applied to AR (matches /admin/valuation logic).
  const provision = Math.max(0, arGrossTotal) * assumptions.receivablesProvisionRate;
  const arNetTotal = Math.max(0, arGrossTotal - provision);

  // Reconciled mid for the cap-table. SIMPLIFIED relative to the
  // /admin/valuation report — we use the market-multiple band only
  // (TTM revenue × midpoint of the low/high multipliers). The full
  // asset-floor reconciliation lives on the valuation page; surfacing
  // a precise number here would require duplicating its 25 queries.
  // The page header discloses that the cap-table values shown are
  // approximations and links to /admin/valuation for the full figure.
  const ttmRevenue = Number(ttmRevenueAgg[0]?.revenue ?? 0);
  const apTotal = apOwedByUs.reduce((s, r) => s + r.balance, 0);
  const royaltyTotal = royalties.summary.totalAccrued;
  const marketLow   = ttmRevenue * assumptions.revenueMultipleLow;
  const marketHigh  = ttmRevenue * assumptions.revenueMultipleHigh;
  const reconciledMid = (marketLow + marketHigh) / 2;

  const capTable = await getPartnerCapTable(reconciledMid);

  // Net financial position — the headline of the page.
  // AR_net − AP_total − royalty_accrual − one_month_payroll.
  // Cash is NOT included (the system doesn't track it). Tax is NOT
  // included. The page header discloses both omissions.
  const oneMonthPayroll = payroll.monthlyPayrollAdjusted;
  const netPosition =
    arNetTotal
    - Math.max(0, apTotal)
    - Math.max(0, royaltyTotal)
    - Math.max(0, oneMonthPayroll);

  const payload = {
    generatedAt: new Date().toISOString(),
    period: { key: period, label: PERIOD_LABELS[period], ...pnl },
    periodOptions: VALID_PERIODS.map(k => ({ key: k, label: PERIOD_LABELS[k] })),
    netPosition: Math.round(netPosition),
    receivables: {
      gross: Math.round(arGrossTotal),
      provisionRate: assumptions.receivablesProvisionRate,
      provision: Math.round(provision),
      net: Math.round(arNetTotal),
      owedToUsTop: arOwedToUs.slice(0, 15).map(r => ({ ...r, balance: Math.round(r.balance) })),
      owedByUsCount: arOwedByUs.length,
      owedByUsTotal: Math.round(arOwedByUs.reduce((s, r) => s + r.balance, 0)),
    },
    payables: {
      total: Math.round(apTotal),
      owedByUsTop: apOwedByUs.slice(0, 15).map(r => ({ ...r, balance: Math.round(r.balance) })),
      owedToUsCount: apOwedToUs.length,
      owedToUsTotal: Math.round(apOwedToUs.reduce((s, r) => s + r.balance, 0)),
    },
    royalties: {
      totalAccrued: Math.round(royaltyTotal),
      agreementsActive: royalties.summary.agreementsActive,
      perAuthor: royalties.agreements
        .filter(a => a.isActive)
        .map(a => ({
          id: a.id,
          payeeName: a.payeeName,
          percentage: a.percentage,
          ttmGrossProfit: Math.round(a.ttmGrossProfit),
          amountAccrued: Math.round(a.amountAccrued),
          lastPaidAt: a.lastPaidAt,
          productsCount: a.productNames.length,
        })),
    },
    payroll: {
      headcount: payroll.headcount,
      monthlyNominal: payroll.monthlyPayrollNominal,
      monthlyAdjusted: payroll.monthlyPayrollAdjusted,
      annualNominal: payroll.annualPayrollNominal,
      annualAdjusted: payroll.annualPayrollAdjusted,
    },
    partners: {
      activeCount: capTable.summary.activeCount,
      totalCount: capTable.summary.totalCount,
      totalStakePercentage: capTable.summary.totalStakePercentage,
      remainingCompanyShare: capTable.summary.remainingCompanyShare,
      isOverCommitted: capTable.summary.isOverCommitted,
      reconciledMid: Math.round(reconciledMid),
      reconciledMidIsApprox: true,
      rows: capTable.rows,
    },
    assumptionsUpdatedAt: valuationAssumptionsRow?.updatedAt?.toISOString() ?? null,
  };

  cache.set(period, { at: Date.now(), payload });
  return NextResponse.json(payload);
}
