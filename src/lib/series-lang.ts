// Series are bought ONE LANGUAGE AT A TIME.
//
// A series such as «ابني يسأل» holds the same stories in several languages
// (42 books for 6 languages). Buying "the series" used to grant every one of
// them, while the product page showed a price prorated to a single language —
// so the customer paid for 7 stories and received 42. This file is the single
// place that decides which books belong to a language and what they cost, and
// it is used by the page display, the PayPal create/capture routes and the
// series buy page so the number shown is always the number charged.
import { egpToUsd } from './currency';

export interface SeriesLangBook {
  language?: string | null;
}

export interface SeriesPricedBook extends SeriesLangBook {
  price: number;
  priceUSD?: number | null;
}

// A book with no language is shown in every language; a bilingual ('both')
// book likewise. Missing/unknown requested language falls back to the schema
// default, Arabic.
export function normalizeSeriesLang(lang?: string | null): string {
  const l = String(lang ?? '').trim().toLowerCase();
  return l || 'ar';
}

export function booksForLang<T extends SeriesLangBook>(books: T[], lang?: string | null): T[] {
  const l = normalizeSeriesLang(lang);
  if (l === 'both') return books;
  return books.filter(b => !b.language || b.language === l || b.language === 'both');
}

export interface SeriesLangPrice {
  count: number;
  egp: number;
  usd: number;
}

// Price of ONE language edition of a series.
//  - seriesPrice / seriesPriceUSD ARE the price of a single language's set of books
//    (6 or 7 stories — the count may differ per language, the price does not). They are
//    NOT divided by the number of languages.
//  - Without a bundle price, the language's own books are simply summed.
export function seriesLangPrice(
  series: { seriesPrice?: number | null; seriesPriceUSD?: number | null },
  allBooks: SeriesPricedBook[],
  lang?: string | null,
): SeriesLangPrice {
  const selected = booksForLang(allBooks, lang);

  const sumEgp = selected.reduce((s, b) => s + Number(b.price || 0), 0);
  const sumUsd = selected.reduce((s, b) => {
    const usd = b.priceUSD && b.priceUSD > 0 ? Number(b.priceUSD) : egpToUsd(Number(b.price || 0));
    return s + usd;
  }, 0);

  const egp = series.seriesPrice && series.seriesPrice > 0 ? Math.round(Number(series.seriesPrice)) : sumEgp;
  const usd = series.seriesPriceUSD && series.seriesPriceUSD > 0
    ? Math.round(Number(series.seriesPriceUSD) * 100) / 100
    : sumUsd;

  return { count: selected.length, egp, usd };
}

export const SERIES_LANG_LABELS: Record<string, string> = {
  ar: 'عربي',
  en: 'English',
  ur: 'اردو',
  id: 'Indonesia',
  de: 'Deutsch',
  fr: 'Français',
};

export function seriesLangLabel(lang: string): string {
  return SERIES_LANG_LABELS[lang] ?? lang.toUpperCase();
}

// The languages a series is actually sold in. 'both' and untagged books belong to
// every language, so they never create an edition of their own.
export function seriesLanguages(books: SeriesLangBook[]): string[] {
  const set = new Set<string>();
  for (const b of books) {
    if (b.language && b.language !== 'both') set.add(b.language);
  }
  return set.size > 0 ? Array.from(set) : ['ar'];
}
