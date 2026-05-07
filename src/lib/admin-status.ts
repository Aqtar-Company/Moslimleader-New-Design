// Shared status palette + normalisation used by every admin surface that
// renders order or campaign status pills. Consolidating into one module
// guarantees the dashboard, orders list, shipments page, and campaign
// detail page all stay visually aligned when statuses get re-themed.

// Order status palette (Arabic canonical labels — all DB statuses map here
// via normalizeStatus).
export const STATUS_COLORS: Record<string, string> = {
  'قيد التجهيز': 'bg-amber-100 text-amber-700',
  'تم الدفع':    'bg-emerald-100 text-emerald-700',
  'تم الشحن':    'bg-blue-100 text-blue-700',
  'تم التسليم':  'bg-green-100 text-green-700',
  'ملغي':        'bg-red-100 text-red-600',
  'pending':     'bg-amber-100 text-amber-700',
};

// Canonical ordered list of order statuses (used by dashboard charts +
// admin order filters).
export const STATUSES = ['قيد التجهيز', 'تم الدفع', 'تم الشحن', 'تم التسليم', 'ملغي'];

// Map English DB statuses to Arabic display labels. Keep aligned with
// the API's status validator (orders accept the English form on write).
export function normalizeStatus(s: string): string {
  if (s === 'pending' || s === 'processing') return 'قيد التجهيز';
  if (s === 'paid') return 'تم الدفع';
  if (s === 'shipped') return 'تم الشحن';
  if (s === 'delivered') return 'تم التسليم';
  if (s === 'cancelled') return 'ملغي';
  return s;
}

// Campaign status labels (used by /admin/campaigns list + detail page).
export const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  sending: 'قيد الإرسال',
  sent: 'تم الإرسال',
  failed: 'فشلت',
};
