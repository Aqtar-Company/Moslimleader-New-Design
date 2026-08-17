import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Math.min(604, parseInt(searchParams.get('page') ?? '1', 10) || 1));

  // Primary: quran.com API
  try {
    const url = `https://api.quran.com/api/v4/quran/verses/by_page/${page}?per_page=50&fields=text_uthmani,verse_number,chapter_id,page_number`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data?.verses) && data.verses.length > 0) {
      return NextResponse.json(data, { headers: CACHE_HEADERS });
    }
    throw new Error('empty verses');
  } catch (primaryErr) {
    console.warn('[quran/verses] primary failed, trying fallback:', primaryErr);
  }

  // Fallback: alquran.cloud
  try {
    const fallbackUrl = `https://api.alquran.cloud/v1/page/${page}/quran-uthmani`;
    const res = await fetch(fallbackUrl, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`fallback upstream ${res.status}`);
    const data = await res.json();
    const ayahs: Array<{ number: number; numberInSurah: number; surah: { number: number }; page: number; text: string }> =
      data?.data?.ayahs ?? [];
    if (ayahs.length === 0) throw new Error('fallback empty');
    const verses = ayahs.map(a => ({
      id: a.number,
      verse_number: a.numberInSurah,
      chapter_id: a.surah.number,
      page_number: a.page,
      text_uthmani: a.text,
    }));
    return NextResponse.json({ verses }, { headers: CACHE_HEADERS });
  } catch (fallbackErr) {
    console.error('[quran/verses] both sources failed:', fallbackErr);
    return NextResponse.json({ error: 'Failed to fetch verses' }, { status: 502 });
  }
}
