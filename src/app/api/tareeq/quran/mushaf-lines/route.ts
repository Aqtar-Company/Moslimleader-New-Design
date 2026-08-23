export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export interface MushafWord {
  text: string;
  codeV1: string;
  codeV2: string;       // encoded text for QCF4 per-page font (use with QCF4{page}.woff2)
  charType: string;
  verseNumber: number;
  chapterId: number;
  lineNumber: number;
}

export interface MushafLine {
  lineNum: number;
  words: MushafWord[];
}

export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1');
  if (page < 1 || page > 604) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_page/${page}?words=true&word_fields=text_uthmani,code_v1,code_v2,line_number,char_type_name&fields=verse_number,chapter_id,juz_number,hizb_number&per_page=50`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();

    const verses: Array<{
      verse_number: number;
      chapter_id: number;
      juz_number?: number;
      hizb_number?: number;
      words: Array<{ text_uthmani: string; code_v1: string; code_v2: string; line_number: number; char_type_name: string }>;
    }> = data.verses ?? [];

    const allWords: MushafWord[] = [];
    for (const verse of verses) {
      for (const w of verse.words ?? []) {
        allWords.push({
          text: w.text_uthmani ?? '',
          codeV1: w.code_v1 ?? '',
          codeV2: w.code_v2 ?? '',
          charType: w.char_type_name ?? 'word',
          verseNumber: verse.verse_number,
          chapterId: verse.chapter_id,
          lineNumber: w.line_number ?? 0,
        });
      }
    }

    const lineMap = new Map<number, MushafWord[]>();
    for (const w of allWords) {
      if (!lineMap.has(w.lineNumber)) lineMap.set(w.lineNumber, []);
      lineMap.get(w.lineNumber)!.push(w);
    }

    const lines: MushafLine[] = Array.from(lineMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([lineNum, words]) => ({ lineNum, words }));

    // Page-level metadata
    const juz = verses[0]?.juz_number ?? null;
    const hizb = verses[0]?.hizb_number ?? null;
    const surahs = [...new Set(verses.map(v => v.chapter_id))];

    return NextResponse.json({ lines, meta: { juz, hizb, surahs } }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    });
  } catch (err) {
    console.error('[mushaf-lines]', err);
    return NextResponse.json({ error: 'failed' }, { status: 502 });
  }
}
