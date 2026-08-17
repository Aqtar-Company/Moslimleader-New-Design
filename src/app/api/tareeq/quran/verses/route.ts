import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Math.min(604, parseInt(searchParams.get('page') ?? '1', 10) || 1));

  const url = `https://api.quran.com/api/v4/quran/verses/by_page/${page}?per_page=50&fields=text_uthmani,verse_number,chapter_id,page_number`;

  try {
    const res = await fetch(url, { cache: 'force-cache', next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    });
  } catch (err) {
    console.error('[quran/verses]', err);
    return NextResponse.json({ error: 'Failed to fetch verses' }, { status: 502 });
  }
}
