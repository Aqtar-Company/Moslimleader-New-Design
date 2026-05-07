import { prisma } from './prisma';

// Compute the live balance for a single supplier — positive = we owe them,
// negative = they owe us, zero = settled. Done at read-time so the row
// can never drift from the underlying transactions. Cheap query: indexed
// on supplierId, single GROUP BY in MySQL.
export async function getSupplierBalance(supplierId: string): Promise<number> {
  const rows = await prisma.supplierTransaction.groupBy({
    by: ['kind'],
    where: { supplierId },
    _sum: { amount: true },
  });
  let owed = 0;
  for (const r of rows) {
    const amt = Number(r._sum.amount ?? 0);
    if (r.kind === 'invoice') owed += amt;
    else owed -= amt; // payment, credit-note both reduce what we owe
  }
  return Math.round(owed * 100) / 100;
}

// Same shape as above, but for every supplier in one round-trip. Used by
// the supplier list and the valuation page.
export async function getAllSupplierBalances(): Promise<Map<string, number>> {
  const rows = await prisma.supplierTransaction.groupBy({
    by: ['supplierId', 'kind'],
    _sum: { amount: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const amt = Number(r._sum.amount ?? 0);
    const sign = r.kind === 'invoice' ? 1 : -1;
    map.set(r.supplierId, (map.get(r.supplierId) ?? 0) + amt * sign);
  }
  // Round each balance once at the boundary.
  for (const [k, v] of map) map.set(k, Math.round(v * 100) / 100);
  return map;
}

export const SUPPLIER_TRANSACTION_KINDS = ['invoice', 'payment', 'credit-note'] as const;
export type SupplierTransactionKind = typeof SUPPLIER_TRANSACTION_KINDS[number];

export const SUPPLIER_TYPES = ['paper', 'supervision', 'manufacturing', 'other'] as const;
export type SupplierType = typeof SUPPLIER_TYPES[number];
