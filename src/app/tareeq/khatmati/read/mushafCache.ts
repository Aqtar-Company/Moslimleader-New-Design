// Module-level cache — persists across React re-renders for the browser session.

export interface MushafWord {
  location: string;   // "surah:verse:wordIndex"
  word: string;       // real Arabic Unicode text
  surah: number;      // parsed from location
  verse: number;      // parsed from location
  position: number;   // parsed from location (1-based)
}

export interface MushafLine {
  line: number;
  type: 'text' | 'surah-header' | 'basmala';
  text?: string;        // for type=text — full line Arabic text
  verseRange?: string;  // for type=text — "surah:verse-surah:verse"
  words?: MushafWord[];
  surah?: string;       // for type=surah-header — "001" format
}

export interface PageData {
  page: number;
  lines: MushafLine[];
}

// Juz start pages for standard Hafs Madinah Mushaf (604 pages, 30 juz)
const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 241, 261, 281, 301, 321, 341, 361, 381,
  401, 421, 441, 461, 481, 501, 521, 541, 561, 581,
];

export function getPageJuz(page: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i++) {
    if (page >= JUZ_START_PAGES[i]) juz = i + 1;
    else break;
  }
  return juz;
}

// Hizb = 2 per juz, approximated from page position within juz
export function getPageHizb(page: number): number {
  const juz = getPageJuz(page);
  const juzStart = JUZ_START_PAGES[juz - 1];
  const juzEnd = JUZ_START_PAGES[juz] ?? 605;
  const midPage = Math.floor((juzStart + juzEnd) / 2);
  return (juz - 1) * 2 + (page >= midPage ? 2 : 1);
}

// In-memory page cache
const _cache = new Map<number, PageData>();
const _inflight = new Map<number, Promise<PageData | null>>();

function pageUrl(page: number): string {
  return `/mushaf-data/page-${String(page).padStart(3, '0')}.json`;
}

function parseLocation(location: string): { surah: number; verse: number; position: number } {
  const [s, v, p] = location.split(':').map(Number);
  return { surah: s ?? 0, verse: v ?? 0, position: p ?? 0 };
}

function processWords(rawWords: Array<{ location: string; word: string; qpcV2?: string; qpcV1?: string }>): MushafWord[] {
  return rawWords.map(w => {
    const { surah, verse, position } = parseLocation(w.location);
    return { location: w.location, word: w.word, surah, verse, position };
  });
}

export function getCachedPage(page: number): PageData | undefined {
  return _cache.get(page);
}

export function fetchAndCachePage(page: number): Promise<PageData | null> {
  if (_cache.has(page)) return Promise.resolve(_cache.get(page)!);
  if (_inflight.has(page)) return _inflight.get(page)!;

  const p = fetch(pageUrl(page))
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((raw: { page: number; lines: Array<{
      line: number; type: string; text?: string;
      verseRange?: string; words?: Array<{ location: string; word: string }>;
      surah?: string;
    }> }) => {
      const data: PageData = {
        page: raw.page,
        lines: raw.lines.map(l => ({
          line: l.line,
          type: l.type as MushafLine['type'],
          text: l.text,
          verseRange: l.verseRange,
          surah: l.surah,
          words: l.words ? processWords(l.words) : undefined,
        })),
      };
      _cache.set(page, data);
      return data;
    })
    .catch(() => null)
    .finally(() => _inflight.delete(page));

  _inflight.set(page, p);
  return p;
}

export async function prepareMushafPage(page: number): Promise<void> {
  if (page < 1 || page > 604) return;
  await fetchAndCachePage(page);
}

export function prefetchPage(page: number): void {
  if (page < 1 || page > 604) return;
  fetchAndCachePage(page);
}
