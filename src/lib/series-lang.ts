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
  id?: string;
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
  count: number;       // books published now in this language
  owned: number;       // of those, books the buyer already has
  payable: number;     // count - owned: the books this purchase actually adds
  planned: number;     // books the edition will have when complete (== count if not set)
  complete: boolean;   // count >= planned
  egp: number;
  usd: number;
}

// Price of ONE language edition of a series.
//  - seriesPrice / seriesPriceUSD ARE the price of a single language's set of books
//    (6 or 7 stories — the count may differ per language, the price does not). They are
//    NOT divided by the number of languages.
//  - Without a bundle price, the language's own books are simply summed.
//  - A buyer who already owns some of the books pays only for the rest: the bundle price
//    × (books not yet owned ÷ books in the edition). Pass `ownedIds` (the buyer's book ids)
//    wherever a price is shown to or charged from a known buyer — the page, paypal-create
//    and paypal-capture all do, so the number shown is still the number charged.
export function seriesLangPrice(
  series: { seriesPrice?: number | null; seriesPriceUSD?: number | null; plannedBookCount?: number | null },
  allBooks: SeriesPricedBook[],
  lang?: string | null,
  ownedIds?: Iterable<string> | null,
): SeriesLangPrice {
  const selected = booksForLang(allBooks, lang);
  const ownedSet = new Set(ownedIds ?? []);
  const unowned = selected.filter(b => !b.id || !ownedSet.has(b.id));
  const owned = selected.length - unowned.length;

  const sumEgp = unowned.reduce((s, b) => s + Number(b.price || 0), 0);
  const sumUsd = unowned.reduce((s, b) => {
    const usd = b.priceUSD && b.priceUSD > 0 ? Number(b.priceUSD) : egpToUsd(Number(b.price || 0));
    return s + usd;
  }, 0);

  let egp = series.seriesPrice && series.seriesPrice > 0 ? Math.round(Number(series.seriesPrice)) : sumEgp;
  let usd = series.seriesPriceUSD && series.seriesPriceUSD > 0
    ? Math.round(Number(series.seriesPriceUSD) * 100) / 100
    : sumUsd;

  // A bundle price is for the WHOLE edition. Charge the share of it this purchase adds:
  //  - while the edition is still being uploaded, only the published books (× published ÷ planned);
  //  - minus the books the buyer already owns (× not-owned ÷ edition).
  // Both are one ratio: books added now ÷ books in the full edition. Complete and nothing
  // owned → 1, the full price. (A summed price already counts only the unowned books.)
  const planned = series.plannedBookCount && series.plannedBookCount > 0 ? Math.floor(series.plannedBookCount) : selected.length;
  const complete = selected.length >= planned;
  const edition = Math.max(planned, selected.length);
  const ratio = edition > 0 ? unowned.length / edition : 0;
  if (ratio < 1) {
    if (series.seriesPrice && series.seriesPrice > 0) egp = Math.round(egp * ratio);
    if (series.seriesPriceUSD && series.seriesPriceUSD > 0) usd = Math.round(usd * ratio * 100) / 100;
  }

  return { count: selected.length, owned, payable: unowned.length, planned, complete, egp, usd };
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
