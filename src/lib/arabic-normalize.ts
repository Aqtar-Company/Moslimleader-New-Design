// Shared Arabic text normalizer — strips diacritics and unifies common
// letter variants so fuzzy matching against Product.name actually works.
// Lifted from scripts/import-whatsapp-orders.ts so the Bosta-orphans
// backfill tool can reuse the exact same matching rules.
export function normaliseArabic(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '') // diacritics
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[\.,،;؛:!?\-_/\\()\[\]"'…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
