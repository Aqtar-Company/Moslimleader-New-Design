/**
 * The languages CONTENT is published in — songs and other media items (FreeMedia.language).
 *
 * The six the digital library already sells in (src/lib/series-lang.ts), plus Spanish and
 * Turkish. Plain JavaScript on purpose: `ops/classify-media-language.mjs` imports the same
 * detection the admin uses, instead of keeping a copy that drifts (see the note on
 * arabic-name-gender.mjs in CLAUDE.md).
 */

/** @typedef {'ar'|'en'|'ur'|'id'|'de'|'fr'|'es'|'tr'} ContentLang */

/** In display order. `native` is the language's own name — what a speaker looks for. */
export const CONTENT_LANGUAGES = [
  { code: 'ar', native: 'عربي', ar: 'عربي', en: 'Arabic', flag: '🇸🇦', rtl: true },
  { code: 'en', native: 'English', ar: 'إنجليزي', en: 'English', flag: '🇬🇧', rtl: false },
  { code: 'ur', native: 'اردو', ar: 'أردو', en: 'Urdu', flag: '🇵🇰', rtl: true },
  { code: 'id', native: 'Indonesia', ar: 'إندونيسي', en: 'Indonesian', flag: '🇮🇩', rtl: false },
  { code: 'de', native: 'Deutsch', ar: 'ألماني', en: 'German', flag: '🇩🇪', rtl: false },
  { code: 'fr', native: 'Français', ar: 'فرنسي', en: 'French', flag: '🇫🇷', rtl: false },
  { code: 'es', native: 'Español', ar: 'إسباني', en: 'Spanish', flag: '🇪🇸', rtl: false },
  { code: 'tr', native: 'Türkçe', ar: 'تركي', en: 'Turkish', flag: '🇹🇷', rtl: false },
];

export const CONTENT_LANG_CODES = CONTENT_LANGUAGES.map(l => l.code);

/** @param {unknown} v @returns {v is ContentLang} */
export function isContentLang(v) {
  return typeof v === 'string' && CONTENT_LANG_CODES.includes(v);
}

/** @param {string|null|undefined} code */
export function contentLang(code) {
  return CONTENT_LANGUAGES.find(l => l.code === code) ?? CONTENT_LANGUAGES[0];
}

// The language NAMED in a title — «نشيد الصلاة (تركي)», "Allahu Akbar - English" — wins.
const NAMED = [
  ['tr', /تركي|تركى|turkish|türkçe|turkce/i],
  ['en', /إنجليزي|انجليزي|انجليزى|إنجليزى|انكليزي|english/i],
  ['es', /إسباني|اسباني|اسبانى|español|espanol|spanish/i],
  ['fr', /فرنسي|فرنسى|français|francais|french/i],
  ['de', /ألماني|الماني|الماني|deutsch|german/i],
  ['ur', /أردو|اردو|urdu/i],
  ['id', /إندونيسي|اندونيسي|indonesia|bahasa/i],
];

/**
 * A best guess from a title. The title naming a language decides; otherwise letters only
 * Turkish uses mean Turkish, a title in Latin script with no Arabic letters means English,
 * and anything else is Arabic — the library's home language.
 * @param {string|null|undefined} title
 * @returns {ContentLang}
 */
export function guessLanguageFromTitle(title) {
  const t = String(title ?? '');
  for (const [code, re] of NAMED) if (re.test(t)) return /** @type {ContentLang} */ (code);
  if (/[ğşıİĞŞ]/.test(t)) return 'tr';
  const arabic = /[؀-ۿ]/.test(t);
  if (!arabic && /[A-Za-z]/.test(t)) return 'en';
  return 'ar';
}
