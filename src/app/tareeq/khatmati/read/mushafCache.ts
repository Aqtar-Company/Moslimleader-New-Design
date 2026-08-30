// Module-level cache — persists across React re-renders for the browser session.
//
// Data source: QCF4 (Quran Complex Font v4) — Madinah Mushaf 1441 AH, Uthman Taha
// calligraphy, King Fahd Complex. Each word is ONE precomposed glyph (PUA codepoint)
// in one of 47 per-page-range fonts, so no Arabic shaping is needed — just render
// `char` with `font-family: word.font`. See /mushaf-qcf4/ for the raw dataset.

export interface MushafWord {
  char: string;        // precomposed glyph character to render
  font: string;        // font-family required to render `char` (QCF4_Hafs_NN or QCF4_QBSML)
  text: string;        // plain Arabic text (for verse-text lookups, sharing, tafsir taps)
  type: 'word' | 'end' | 'surah_header' | 'bismillah' | 'quarter';
  surah: number;        // 0 when not applicable
  verse: number;        // 0 when not applicable
}

export interface MushafLine {
  line: number;
  words: MushafWord[];
}

export interface SurahOnPage {
  id: number;
  nameArabic: string;
}

export interface PageData {
  page: number;
  font: string;           // primary QCF4_Hafs_NN font for this page (from font-map.json)
  surahs: SurahOnPage[];
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
  return `/mushaf-qcf4/pages/${String(page).padStart(3, '0')}.json`;
}

function parseVerseKey(key: string | undefined): { surah: number; verse: number } {
  if (!key) return { surah: 0, verse: 0 };
  const [s, v] = key.split(':').map(Number);
  return { surah: s ?? 0, verse: v ?? 0 };
}

interface RawWord {
  char: string;
  font: string;
  text?: string;
  type: MushafWord['type'];
  verse_key?: string;
  sura?: number;
}

interface RawLine {
  line: number;
  words: RawWord[];
}

interface RawPage {
  page: number;
  font: string;
  surahs?: Array<{ id: number; name_arabic: string }>;
  lines: RawLine[];
}

function processWords(rawWords: RawWord[]): MushafWord[] {
  return rawWords.map(w => {
    const { surah, verse } = parseVerseKey(w.verse_key);
    return {
      char: w.char,
      font: w.font,
      text: w.text ?? '',
      type: w.type,
      surah: surah || w.sura || 0,
      verse,
    };
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
    .then((raw: RawPage) => {
      const data: PageData = {
        page: raw.page,
        font: raw.font,
        surahs: (raw.surahs ?? []).map(s => ({ id: s.id, nameArabic: s.name_arabic })),
        lines: raw.lines.map(l => ({
          line: l.line,
          words: processWords(l.words ?? []),
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

// Surah-name glyphs from the QBSML font — the same calligraphic style used
// for in-Mushaf surah header frames (see SurahHeader in MushafQCFPage.tsx).
// "surah_headers_style_a" is qbsml.json's canonical, purpose-built set for
// this exact use (one entry per surah, normally-kerned).
let _surahGlyphs: Map<number, string> | null = null;
let _surahGlyphsPromise: Promise<Map<number, string>> | null = null;

interface QbsmlData {
  sets: Array<{ name: string; entries: Array<{ sura: number; codepoint: number }> }>;
}

export function fetchSurahHeaderGlyphs(): Promise<Map<number, string>> {
  if (_surahGlyphs) return Promise.resolve(_surahGlyphs);
  if (_surahGlyphsPromise) return _surahGlyphsPromise;

  const p = fetch('/mushaf-qcf4/qbsml.json')
    .then(r => r.json())
    .then((data: QbsmlData) => {
      const map = new Map<number, string>();
      const styleA = data.sets.find(s => s.name === 'surah_headers_style_a');
      for (const e of styleA?.entries ?? []) map.set(e.sura, String.fromCharCode(e.codepoint));
      _surahGlyphs = map;
      return map;
    })
    .catch(() => new Map<number, string>())
    .finally(() => { _surahGlyphsPromise = null; });

  _surahGlyphsPromise = p;
  return p;
}
