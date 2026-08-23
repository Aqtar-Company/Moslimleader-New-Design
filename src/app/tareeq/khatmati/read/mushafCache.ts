// Module-level cache — persists across React re-renders for the lifetime of the browser session.

/*
 * QCF font URL — routed through our own Next.js proxy because
 * fonts.qurancdn.com returns 403 on direct browser requests from
 * non-quran.com origins. The proxy fetches server-side and caches
 * the response for 1 year.
 */
function qcfFontUrl(page: number): string {
  return `/api/tareeq/quran/qcf-font?page=${page}`;
}

export interface MushafWord {
  text: string;
  codeV1: string;
  codeV2: string;
  charType: string;
  verseNumber: number;
  chapterId: number;
  lineNumber: number;
}

export interface MushafLine {
  lineNum: number;
  words: MushafWord[];
}

export interface PageMeta {
  juz: number | null;
  hizb: number | null;
  surahs: number[];
}

export interface PageData {
  lines: MushafLine[];
  meta: PageMeta;
}

const _cache = new Map<number, PageData>();
const _inflight = new Map<number, Promise<PageData | null>>();

// Global font-ready set — survives React re-renders and component remounts.
const _fontLoaded = new Set<string>();
const _fontInflight = new Map<string, Promise<void>>();

// Surahnames icon font — single shared file, not per-page.
let _surahNamesLoaded = false;
let _surahNamesInflight: Promise<void> | null = null;

export function getCachedPage(page: number): PageData | undefined {
  return _cache.get(page);
}

export function isFontLoaded(family: string): boolean {
  return _fontLoaded.has(family);
}

export function isSurahNamesFontLoaded(): boolean {
  return _surahNamesLoaded;
}

/*
 * Warm the surahnames icon font using the FontFace API so it is guaranteed
 * loaded before any SurahHeader renders. This avoids the font-display:block
 * FOIT window (invisible text for up to 3 s) that caused the ornament to
 * appear empty on swipe — especially visible on page 2 (البقرة header).
 */
export function warmSurahNamesFont(): Promise<void> {
  if (_surahNamesLoaded) return Promise.resolve();
  if (_surahNamesInflight) return _surahNamesInflight;
  if (typeof document === 'undefined') return Promise.resolve();

  const face = new FontFace('surahnames', "url('/fonts/sura_names.woff2') format('woff2')");
  document.fonts.add(face);

  _surahNamesInflight = face.load()
    .then(() => { _surahNamesLoaded = true; })
    .catch(() => {})
    .finally(() => { _surahNamesInflight = null; });

  return _surahNamesInflight;
}

export function warmQCFFont(page: number): Promise<void> {
  const family = `p${page}-v2`;
  if (_fontLoaded.has(family)) return Promise.resolve();
  if (_fontInflight.has(family)) return _fontInflight.get(family)!;
  if (typeof document === 'undefined') return Promise.resolve();

  /*
   * Use the FontFace constructor API so the font is loaded directly from the
   * CDN URL without requiring a prior @font-face declaration in a stylesheet.
   * document.fonts.load() silently no-ops when no @font-face is declared for
   * the family — this was the root cause of persistent QCF_FONT_NOT_READY.
   */
  const url = qcfFontUrl(page);
  const face = new FontFace(family, `url('${url}')`);
  document.fonts.add(face);

  const p = face.load()
    .then(() => { _fontLoaded.add(family); })
    .catch(() => {})
    .finally(() => _fontInflight.delete(family));

  _fontInflight.set(family, p);
  return p;
}

export async function prepareMushafPage(page: number): Promise<void> {
  if (page < 1 || page > 604) return;
  await Promise.all([fetchAndCachePage(page), warmQCFFont(page)]);
}

export function fetchAndCachePage(page: number): Promise<PageData | null> {
  if (_cache.has(page)) return Promise.resolve(_cache.get(page)!);
  if (_inflight.has(page)) return _inflight.get(page)!;

  const p = fetch(`/api/tareeq/quran/mushaf-lines?page=${page}`)
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(d => {
      if (d.lines) {
        const data: PageData = { lines: d.lines, meta: d.meta };
        _cache.set(page, data);
        return data;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => _inflight.delete(page));

  _inflight.set(page, p);
  return p;
}

export function prefetchPage(page: number): void {
  if (page < 1 || page > 604) return;
  fetchAndCachePage(page);
}
