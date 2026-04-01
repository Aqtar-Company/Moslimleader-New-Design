export type AgeLang = 'ar' | 'en';

/** Converts western digits to Eastern Arabic numerals (٠١٢٣...) */
function toEasternArabic(n: number): string {
  return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
}

/**
 * Returns a human-readable age label for a book.
 *
 * Arabic examples:
 *   minAge=null              → ''
 *   minAge=4,  maxAge=null   → '+٤ سنوات'   (open-ended)
 *   minAge=4,  maxAge=8      → '٤ - ٨ سنة'  (range)
 *   minAge=4,  maxAge=4      → '٤ سنوات'    (single age)
 *   + needsParentalGuide     → appends '| يحتاج مساعدة الوالدين'
 *
 * English examples:
 *   minAge=4,  maxAge=null   → '4+ years'
 *   minAge=4,  maxAge=8      → '4 – 8 years'
 *   minAge=4,  maxAge=4      → '4 years'
 *   + needsParentalGuide     → appends '| Parental Guidance'
 */
export function formatAgeLabel(
  minAge: number | null | undefined,
  maxAge: number | null | undefined,
  needsParentalGuide: boolean,
  lang: AgeLang = 'ar',
): string {
  if (minAge == null) return '';

  const isAr = lang === 'ar';
  const fmt = (n: number) => isAr ? toEasternArabic(n) : n.toString();

  let ageStr: string;

  if (maxAge == null) {
    // Open-ended: X+
    ageStr = isAr
      ? `+${fmt(minAge)} سنوات`
      : `${fmt(minAge)}+ years`;
  } else if (maxAge === minAge) {
    // Single age
    ageStr = isAr
      ? `${fmt(minAge)} سنوات`
      : `${fmt(minAge)} years`;
  } else {
    // Range
    ageStr = isAr
      ? `${fmt(minAge)} - ${fmt(maxAge)} سنة`
      : `${fmt(minAge)} – ${fmt(maxAge)} years`;
  }

  if (needsParentalGuide) {
    ageStr += isAr ? ' | يحتاج مساعدة الوالدين' : ' | Parental Guidance';
  }

  return ageStr;
}
