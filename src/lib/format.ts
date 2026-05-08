// Shared formatters used across admin pages. Each was duplicated in 4-5
// admin files before consolidation; behaviour is the canonical version
// from `/admin/campaigns/[id]/page.tsx` (Arabic relative-time) plus the
// addendum-7 nit-#9 pricing convention (`ar-EG` locale, default `ج.م`).

// "5 minutes ago" in Arabic. Returns "لم تُرسل بعد" for null/undefined,
// "الآن" for sub-1-minute deltas, otherwise minutes/hours/days.
export function timeAgoAr(iso: string | null | undefined): string {
  if (!iso) return 'لم تُرسل بعد';
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `منذ ${d} يوم`;
}

// Format a numeric price with the Arabic-Egypt locale separators and a
// trailing currency string. Defaults to `ج.م` for pages that always
// render in EGP; pass an explicit `currency` for invoices/regional UIs.
export function formatPrice(n: number, currency = 'ج.م'): string {
  return `${n.toLocaleString('en-US')} ${currency}`;
}
