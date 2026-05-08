import type { Prisma } from '@prisma/client';

// Single source of truth for "what counts as a sale" across the admin.
// Both /admin/valuation and /admin/inventory and /admin/reports/sales-by-product
// pull these constants so we don't end up with three slightly-different
// definitions of "sold". When the business definition of an import or a
// gift changes, this is the only file that needs a touch.

// Imports: orders that came in via the migration scripts. Their stock
// effects already happened in the previous system (or never happened at
// all because the migration was inventory-flat). They count toward
// lifetime sold but NOT toward live deductions.
export const IMPORT_SOURCES = ['whatsapp_cleaned_ready'] as const;
export const IMPORT_PAYMENT_METHODS = ['bosta-historical'] as const;

// Filter: "is this an import order?". Used to bucket orders in reports.
export const IS_IMPORT_ORDER: Prisma.OrderWhereInput = {
  OR: [
    { source: { in: [...IMPORT_SOURCES] } },
    { paymentMethod: { in: [...IMPORT_PAYMENT_METHODS] } },
  ],
};

// Non-cancelled, non-gift — what a normal admin would call "sold".
// Lifetime view: includes imports.
export const NON_GIFT: Prisma.OrderWhereInput = {
  status: { not: 'cancelled' },
  paymentMethod: { not: 'gift' },
};

// Live view: excludes imports AND gifts. This is what should drive
// stock-deduction analyses, because imports never decremented stock.
export const NON_GIFT_LIVE: Prisma.OrderWhereInput = {
  status: { not: 'cancelled' },
  paymentMethod: { notIn: ['gift', ...IMPORT_PAYMENT_METHODS] },
  OR: [{ source: null }, { source: { notIn: [...IMPORT_SOURCES] } }],
};

// Gifts only (non-cancelled). These have a cost (we shipped a real
// product) but no revenue, so they're tracked separately.
export const GIFT_ONLY: Prisma.OrderWhereInput = {
  status: { not: 'cancelled' },
  paymentMethod: 'gift',
};
