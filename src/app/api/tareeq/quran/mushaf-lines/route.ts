export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export interface MushafWord {
  text: string;
  charType: string;  // 'word' | 'end' | 'pause' | 'sajdah' | 'rubhizb'
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
      `https://api.quran.com/api/v4/verses/by_page/${page}?words=true&word_fields=text_uthmani,line_number,char_type_name&fields=verse_number,chapter_id&per_page=50`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();

    const verses: Array<{
      verse_number: number;
      chapter_id: number;
      words: Array<{ text_uthmani: string; line_number: number; char_type_name: string }>;
    }> = data.verses ?? [];

    // Flatten all words across all verses, keeping verse context
    const allWords: MushafWord[] = [];
    for (const verse of verses) {
      for (const w of verse.words ?? []) {
        allWords.push({
          text: w.text_uthmani ?? '',
          charType: w.char_type_name ?? 'word',
          verseNumber: verse.verse_number,
          chapterId: verse.chapter_id,
          lineNumber: w.line_number ?? 0,
        });
      }
    }

    // Group by line number (preserve insertion order = reading order)
    const lineMap = new Map<number, MushafWord[]>();
    for (const w of allWords) {
      if (!lineMap.has(w.lineNumber)) lineMap.set(w.lineNumber, []);
      lineMap.get(w.lineNumber)!.push(w);
    }

    const lines: MushafLine[] = Array.from(lineMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([lineNum, words]) => ({ lineNum, words }));

    return NextResponse.json({ lines }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    });
  } catch (err) {
    console.error('[mushaf-lines]', err);
    return NextResponse.json({ error: 'failed' }, { status: 502 });
  }
}
