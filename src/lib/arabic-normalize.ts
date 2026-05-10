// Shared Arabic text normalizer — strips diacritics and unifies common
// letter variants so fuzzy matching against Product.name actually works.
//
// CRITICAL: the diacritics regex MUST use \u escapes. The previous
// literal-character form contained a range like ؐ-ً (U+0610-U+064B)
// which silently swallowed every Arabic LETTER (U+0621-U+063A,
// U+0641-U+064A) sitting between those two endpoints — the
// "normalised" string came out empty and every comparison registered
// as a perfect match. See plan addendum 25.
//
// Ranges below cover ONLY combining marks / format chars, never
// letters:
//   ؐ-ؚ : Arabic signs (sallallahou, etc.)
//   ـ        : tatweel (kashida)
//   ً-ٟ : tashkeel + extended marks
//   ٰ        : superscript alif
//   ۖ-ۭ : Quranic combining marks
const DIACRITICS_RE = /[ؐ-ؚـً-ٰٟۖ-ۭ]/g;

export function normaliseArabic(s: string): string {
  return s
    .replace(DIACRITICS_RE, '')
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/[إأآا]/g, 'ا') // إ أ آ ا → ا
    .replace(/[\.,،;؛:!?\-_/\\()\[\]"'…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
