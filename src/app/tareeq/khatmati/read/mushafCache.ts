// Module-level cache — persists across React re-renders for the lifetime of the browser session.

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
// Once a QCF font is confirmed loaded, any MushafQCFPage for that page skips
// the setQcfReady(false) flash entirely.
const _fontLoaded = new Set<string>();
const _fontInflight = new Map<string, Promise<void>>();

export function getCachedPage(page: number): PageData | undefined {
  return _cache.get(page);
}

export function isFontLoaded(family: string): boolean {
  return _fontLoaded.has(family);
}

export function warmQCFFont(page: number): Promise<void> {
  const family = `p${page}-v2`;
  if (_fontLoaded.has(family)) return Promise.resolve();
  if (_fontInflight.has(family)) return _fontInflight.get(family)!;
  if (typeof document === 'undefined') return Promise.resolve();

  const p = document.fonts
    .load(`16px '${family}'`)
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
