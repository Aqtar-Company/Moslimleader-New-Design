import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SURAH_NAMES_AR, SURAH_NAMES_EN } from '@/lib/quran-data';

export const dynamic = 'force-dynamic';

// Full-text search over the Quran, built entirely from data already shipped
// with the app (public/mushaf-qcf4/pages/*.json — the same per-word QCF4
// dataset the Mushaf reader itself renders) instead of an external API: no
// network dependency, no rate limit, and the result's page number is exact
// (the Mushaf JSON is keyed by page already) rather than guessed.

interface RawWord { text?: string; type: string; verse_key?: string; }
interface RawLine { words: RawWord[]; }
interface RawPage { lines: RawLine[]; }

interface IndexedVerse { surah: number; verse: number; page: number; text: string; }

let _index: IndexedVerse[] | null = null;
let _indexPromise: Promise<IndexedVerse[]> | null = null;

// Arabic combining diacritics (tashkeel/harakat + Quranic annotation marks) —
// deliberately excludes the Arabic-Indic digit block (U+0660-U+0669), which
// sits right in the middle of this section of the Arabic Unicode range.
const DIACRITICS_RE = /[ً-ٰٟۖ-ۜ۟-ۤۧ-۪ۨ-ۭࣔ-ࣣ࣡-ࣿ]/g;

// Loose match: strip diacritics and normalize letter variants users commonly
// type interchangeably (alef forms, ta marbuta/ha, ya/alef maqsura) so a
// plain, undiacritized query still finds fully-vocalized Mushaf text.
function normalizeArabic(s: string): string {
  return s
    .normalize('NFKD')
    .replace(DIACRITICS_RE, '')
    .replace(/[آأإٱ]/g, 'ا') // alef variants -> alef
    .replace(/ى/g, 'ي') // alef maqsura -> ya
    .replace(/ة/g, 'ه') // ta marbuta -> ha
    .replace(/ؤ/g, 'و') // waw hamza -> waw
    .replace(/ئ/g, 'ي') // ya hamza -> ya
    .replace(/ـ/g, '') // tatweel
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildIndex(): Promise<IndexedVerse[]> {
  const dir = path.join(process.cwd(), 'public', 'mushaf-qcf4', 'pages');
  const map = new Map<string, IndexedVerse>();
  for (let page = 1; page <= 604; page++) {
    const file = path.join(dir, `${String(page).padStart(3, '0')}.json`);
    let raw: RawPage;
    try {
      raw = JSON.parse(await fs.readFile(file, 'utf-8'));
    } catch {
      continue;
    }
    for (const line of raw.lines ?? []) {
      for (const w of line.words ?? []) {
        if (w.type !== 'word' || !w.verse_key || !w.text) continue;
        const [sStr, vStr] = w.verse_key.split(':');
        const surah = Number(sStr);
        const verse = Number(vStr);
        if (!surah || !verse) continue;
        const existing = map.get(w.verse_key);
        if (existing) existing.text += ' ' + w.text;
        else map.set(w.verse_key, { surah, verse, page, text: w.text });
      }
    }
  }
  return Array.from(map.values());
}

function getIndex(): Promise<IndexedVerse[]> {
  if (_index) return Promise.resolve(_index);
  if (_indexPromise) return _indexPromise;
  _indexPromise = buildIndex().then(idx => { _index = idx; _indexPromise = null; return idx; });
  return _indexPromise;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get('q') ?? '').trim().slice(0, 100);
  if (qRaw.length < 2) return NextResponse.json({ results: [] });

  const q = normalizeArabic(qRaw);
  const index = await getIndex();

  const results: Array<{ surah: number; verse: number; page: number; surahNameAr: string; surahNameEn: string; text: string }> = [];
  for (const v of index) {
    if (normalizeArabic(v.text).includes(q)) {
      results.push({
        surah: v.surah,
        verse: v.verse,
        page: v.page,
        surahNameAr: SURAH_NAMES_AR[v.surah - 1] ?? '',
        surahNameEn: SURAH_NAMES_EN[v.surah - 1] ?? '',
        text: v.text,
      });
      if (results.length >= 50) break;
    }
  }

  return NextResponse.json({ results });
}
