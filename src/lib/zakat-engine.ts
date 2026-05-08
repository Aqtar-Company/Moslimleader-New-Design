import { prisma } from './prisma';
import { totalReceivables } from './customer-receivables';
import { NON_GIFT } from './order-filters';

// The Zakat-on-trade-goods compute engine. Pure read of inventory +
// orders + receivables + supplier liabilities. No side effects so it
// can be used by both the dry-run preview and the persisted snapshot.

export type ValuationMethod = 'retail' | 'wholesale' | 'avg-actual' | 'manual';
export const ZAKAT_RATE = 0.025;
export const WHOLESALE_FALLBACK_RATIO = 0.85; // when Product.wholesalePrice is null

export interface ZakatItem {
  productId: string;
  productName: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  valuationMethod: ValuationMethod;
}

export interface ZakatComputation {
  items: ZakatItem[];
  inventoryValueRetail: number;
  inventoryValueWholesale: number;
  inventoryValueAvgActual: number;
  inventoryValueManual: number | null;
  inventoryValueUsed: number;
  cashOnHand: number;
  receivables: number;
  liabilities: number;
  zakatPool: number;
  zakatAmount: number;
  // Per-method comparison for the UI table.
  comparison: Array<{ method: ValuationMethod; inventory: number; pool: number; zakat: number }>;
}

export interface ZakatComputeInput {
  method: ValuationMethod;
  cashOnHand: number;
  avgActualWindowDays?: number;            // for 'avg-actual' method
  manualValuation?: Record<string, number>; // productId → unitValue
}

// Compute supplier liabilities the same way /admin/valuation does:
// SUM(invoice) − SUM(payment) − SUM(credit-note), positive = we owe.
async function getSupplierLiabilities(): Promise<number> {
  const rows = await prisma.supplierTransaction.groupBy({
    by: ['kind'],
    _sum: { amount: true },
  });
  let liab = 0;
  for (const r of rows) {
    const amt = Number(r._sum.amount ?? 0);
    liab += r.kind === 'invoice' ? amt : -amt;
  }
  return Math.max(0, Math.round(liab * 100) / 100);
}

// Per-product weighted-average actual selling price across the chosen
// window. Falls back to retail when a product has no recent sales.
async function getAvgActualPrices(windowDays: number): Promise<Map<string, number>> {
  const since = new Date(Date.now() - windowDays * 86400000);
  const rows = await prisma.$queryRaw<Array<{ productId: string; revenue: number; quantity: number }>>`
    SELECT oi.productId, SUM(oi.unitPrice * oi.quantity) AS revenue, SUM(oi.quantity) AS quantity
    FROM OrderItem oi
    JOIN \`Order\` o ON o.id = oi.orderId
    WHERE o.status != 'cancelled'
      AND o.paymentMethod != 'gift'
      AND o.createdAt >= ${since}
    GROUP BY oi.productId
  `;
  const map = new Map<string, number>();
  for (const r of rows) {
    const q = Number(r.quantity);
    const rev = Number(r.revenue);
    if (q > 0) map.set(r.productId, rev / q);
  }
  return map;
}

export async function computeZakat(input: ZakatComputeInput): Promise<ZakatComputation> {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, price: true, wholesalePrice: true, stock: true },
  });

  const window = input.avgActualWindowDays ?? 90;
  const avgActualMap = await getAvgActualPrices(window);

  // Compute every method's total inventory value in one pass — needed
  // for the comparison view and for whichever method the admin chose.
  let invRetail = 0;
  let invWholesale = 0;
  let invAvgActual = 0;
  let invManual: number | null = null;
  const items: ZakatItem[] = [];

  for (const p of products) {
    if (p.stock <= 0) continue;
    const retailUnit = p.price;
    const wholesaleUnit = p.wholesalePrice ?? p.price * WHOLESALE_FALLBACK_RATIO;
    const avgActualUnit = avgActualMap.get(p.id) ?? p.price;
    const manualUnit = input.manualValuation?.[p.id];

    invRetail += p.stock * retailUnit;
    invWholesale += p.stock * wholesaleUnit;
    invAvgActual += p.stock * avgActualUnit;
    if (manualUnit !== undefined && Number.isFinite(manualUnit) && manualUnit >= 0) {
      if (invManual === null) invManual = 0;
      invManual += p.stock * manualUnit;
    }

    // Per-item snapshot row reflecting the CHOSEN method.
    let unitValue: number;
    switch (input.method) {
      case 'retail':     unitValue = retailUnit; break;
      case 'wholesale':  unitValue = wholesaleUnit; break;
      case 'avg-actual': unitValue = avgActualUnit; break;
      case 'manual':     unitValue = manualUnit ?? retailUnit; break;
    }
    items.push({
      productId: p.id, productName: p.name,
      quantity: p.stock,
      unitValue: Math.round(unitValue * 100) / 100,
      totalValue: Math.round(p.stock * unitValue * 100) / 100,
      valuationMethod: input.method,
    });
  }

  // If admin chose 'manual' but didn't supply a single override, the
  // total is just retail (the fallback per-item logic above). Surface
  // that fact by setting invManual = invRetail in that case.
  if (input.method === 'manual' && invManual === null) invManual = invRetail;

  const inventoryValueUsed =
    input.method === 'retail'     ? invRetail :
    input.method === 'wholesale'  ? invWholesale :
    input.method === 'avg-actual' ? invAvgActual :
                                    (invManual ?? invRetail);

  const [receivables, liabilities] = await Promise.all([
    totalReceivables(),
    getSupplierLiabilities(),
  ]);

  const cashOnHand = Math.max(0, Number(input.cashOnHand) || 0);
  const zakatPool = Math.max(0, inventoryValueUsed + cashOnHand + receivables - liabilities);
  const zakatAmount = zakatPool * ZAKAT_RATE;

  const comparisonFor = (method: ValuationMethod, inv: number) => {
    const pool = Math.max(0, inv + cashOnHand + receivables - liabilities);
    return { method, inventory: Math.round(inv), pool: Math.round(pool), zakat: Math.round(pool * ZAKAT_RATE) };
  };

  return {
    items,
    inventoryValueRetail: Math.round(invRetail),
    inventoryValueWholesale: Math.round(invWholesale),
    inventoryValueAvgActual: Math.round(invAvgActual),
    inventoryValueManual: invManual === null ? null : Math.round(invManual),
    inventoryValueUsed: Math.round(inventoryValueUsed),
    cashOnHand: Math.round(cashOnHand),
    receivables: Math.round(receivables),
    liabilities: Math.round(liabilities),
    zakatPool: Math.round(zakatPool),
    zakatAmount: Math.round(zakatAmount),
    comparison: [
      comparisonFor('retail', invRetail),
      comparisonFor('wholesale', invWholesale),
      comparisonFor('avg-actual', invAvgActual),
      comparisonFor('manual', invManual ?? invRetail),
    ],
  };
}

// Used by NON_GIFT export: re-export so route files can import without
// pulling order-filters directly.
export { NON_GIFT };
