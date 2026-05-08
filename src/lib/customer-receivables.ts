import { prisma } from './prisma';

// Customer accounts-receivable ledger helpers. Mirrors src/lib/suppliers.ts
// on the OTHER side of the balance:
//   POSITIVE balance = customer owes us (we have a receivable / asset)
//   NEGATIVE balance = we owe them (overpayment / advance — a liability)
//   ZERO = settled
// Computed at read-time so the row can never drift from the transactions.

export async function getCustomerBalance(customerId: string): Promise<number> {
  const rows = await prisma.customerTransaction.groupBy({
    by: ['kind'],
    where: { customerId },
    _sum: { amount: true },
  });
  let owed = 0;
  for (const r of rows) {
    const amt = Number(r._sum.amount ?? 0);
    if (r.kind === 'invoice') owed += amt;
    else owed -= amt; // payment + credit-note reduce what they owe
  }
  return Math.round(owed * 100) / 100;
}

export async function getAllReceivableBalances(): Promise<Map<string, number>> {
  const rows = await prisma.customerTransaction.groupBy({
    by: ['customerId', 'kind'],
    _sum: { amount: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const amt = Number(r._sum.amount ?? 0);
    const sign = r.kind === 'invoice' ? 1 : -1;
    map.set(r.customerId, (map.get(r.customerId) ?? 0) + amt * sign);
  }
  for (const [k, v] of map) map.set(k, Math.round(v * 100) / 100);
  return map;
}

// Sum of POSITIVE balances only — what customers owe us in aggregate.
// Used by the valuation report (adds to baseValue) and the Zakat
// calculator (counts toward the pool as ديون مرجوّة التحصيل).
export async function totalReceivables(): Promise<number> {
  const map = await getAllReceivableBalances();
  let sum = 0;
  for (const v of map.values()) {
    if (v > 0) sum += v;
  }
  return Math.round(sum * 100) / 100;
}

export const CUSTOMER_TRANSACTION_KINDS = ['invoice', 'payment', 'credit-note'] as const;
export type CustomerTransactionKind = typeof CUSTOMER_TRANSACTION_KINDS[number];
