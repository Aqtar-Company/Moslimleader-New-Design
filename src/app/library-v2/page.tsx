'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { resolvePrice } from '@/lib/geo-pricing';

interface Book {
  id: string;
  title: string;
  titleEn?: string;
  cover: string;
  description: string;
  author?: string;
  authorEn?: string;
  language?: string;
  section?: string;
  price: number;
  priceUSD?: number;
  freePages: number;
  totalPages: number;
  minAge?: number | null;
  maxAge?: number | null;
  seriesId?: string | null;
  seriesOrder?: number | null;
  _count: { accesses: number };
}

interface SeriesBook {
  id: string;
  title: string;
  titleEn?: string;
  cover: string;
  price: number;
  priceUSD?: number;
  seriesOrder?: number;
  language?: string;
  freePages: number;
  totalPages: number;
}

interface BookSeriesData {
  id: string;
  name: string;
  nameEn?: string;
  slug: string;
  description?: string;
  cover?: string;
  seriesPrice?: number;
  seriesPriceUSD?: number;
  language?: string;
  books: SeriesBook[];
}

type LangFilter = 'all' | 'ar' | 'en' | 'ur' | 'id' | 'de' | 'fr';

const LANG_OPTIONS: { id: LangFilter; label: string; flag: string }[] = [
  { id: 'all', label: 'الكل',      flag: '🌐' },
  { id: 'ar',  label: 'عربي',      flag: '🇸🇦' },
  { id: 'en',  label: 'English',   flag: '🇬🇧' },
  { id: 'ur',  label: 'اردو',      flag: '🇵🇰' },
  { id: 'id',  label: 'Indonesia', flag: '🇮🇩' },
  { id: 'de',  label: 'Deutsch',   flag: '🇩🇪' },
  { id: 'fr',  label: 'Français',  flag: '🇫🇷' },
];

const SHELF_COLORS = [
  '#C8B49A', '#B8A88A', '#D4C0A0', '#C0AC90',
  '#BAA888', '#CCC0A8', '#B4A282', '#CCB898',
];

/* ─── Book card standing on shelf ─── */
function BookSpine({
  book,
  href,
  price,
  isEn,
}: {
  book: { cover: string; title: string; titleEn?: string; freePages: number; language?: string };
  href: string;
  price: string;
  isEn: boolean;
}) {
  const title = isEn && book.titleEn ? book.titleEn : book.title;
  return (
    <Link href={href} className="group shrink-0 flex flex-col items-center" style={{ width: 106 }}>
      <div
        className="relative w-[84px] h-[126px] transition-all duration-300 ease-out group-hover:-translate-y-4 group-hover:rotate-1"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Cover */}
        <div
          className="absolute inset-0 rounded-[3px] overflow-hidden bg-[#1a1a2e]"
          style={{ boxShadow: '5px 8px 20px rgba(0,0,0,0.4), inset -4px 0 8px rgba(0,0,0,0.25)' }}
        >
          {book.cover ? (
            <Image src={book.cover} alt={title} fill className="object-cover" unoptimized sizes="84px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">📖</div>
          )}
          {/* Left spine shadow */}
          <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
          {/* Sheen on hover */}
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-colors duration-300 pointer-events-none" />
        </div>

        {/* Free badge */}
        {book.freePages > 0 && (
          <span className="absolute -top-2 -right-2 z-10 bg-amber-400 text-[#1a1a2e] text-[7px] font-black px-1.5 py-0.5 rounded-full shadow leading-tight">
            {isEn ? 'FREE' : 'مجاني'}
          </span>
        )}

        {/* Language badge */}
        {book.language && book.language !== 'ar' && (
          <span className="absolute bottom-1 left-1 z-10 text-[7px] bg-black/65 text-white px-1 py-0.5 rounded font-bold tracking-wide">
            {book.language === 'both' ? 'AR/EN' : book.language.toUpperCase()}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="mt-2.5 w-full text-center px-0.5">
        <p className="text-[11px] font-bold text-gray-700 leading-snug line-clamp-2 group-hover:text-amber-700 transition-colors">
          {title}
        </p>
        <p className="text-[11px] font-black text-amber-600 mt-0.5">{price}</p>
      </div>
    </Link>
  );
}

/* ─── Single shelf row ─── */
function Shelf({
  title,
  books,
  isEn,
  getPrice,
  color = '#C8B49A',
}: {
  title: string;
  books: Array<{ id: string; cover: string; title: string; titleEn?: string; price: number; priceUSD?: number; freePages: number; language?: string }>;
  isEn: boolean;
  getPrice: (b: { price: number; priceUSD?: number }) => string;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (books.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-base font-black text-gray-800">{title}</h2>
        <span className="text-[11px] text-gray-400 font-medium">
          {books.length} {isEn ? 'books' : 'كتاب'}
        </span>
      </div>

      <div className="relative">
        {/* Books row */}
        <div
          ref={ref}
          className="flex gap-3 overflow-x-auto pb-4 px-1 scrollbar-none"
          dir="ltr"
        >
          {books.map(b => (
            <BookSpine
              key={b.id}
              book={b}
              href={`/library/${b.id}`}
              price={getPrice(b)}
              isEn={isEn}
            />
          ))}
          <div className="shrink-0 w-1" />
        </div>

        {/* Shelf plank */}
        <div
          className="h-[10px] rounded-full mx-1"
          style={{
            background: `linear-gradient(180deg, ${color}ee 0%, #9a7d5a 100%)`,
            boxShadow: '0 5px 14px rgba(0,0,0,0.28)',
          }}
        />
        {/* Drop shadow under plank */}
        <div
          className="h-2 mx-8 rounded-full mt-0.5 opacity-40"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, transparent 75%)' }}
        />
      </div>
    </section>
  );
}

/* ─── Page ─── */
export default function LibraryV2Page() {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const { zone, countryCode, formatPrice } = useRegionalPricing();

  const getPrice = (b: { price: number; priceUSD?: number }) => {
    if (b.price === 0) return isEn ? 'Free' : 'مجاني';
    return formatPrice(resolvePrice(b.price, b.priceUSD ?? 0, zone, countryCode));
  };

  const [books, setBooks]   = useState<Book[]>([]);
  const [series, setSeries] = useState<BookSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [activeLang, setActiveLang] = useState<LangFilter>('all');

  useEffect(() => {
    Promise.all([
      fetch('/api/books').then(r => r.json()),
      fetch('/api/series').then(r => r.json()),
    ])
      .then(([bRes, sRes]) => {
        setBooks(bRes.books ?? []);
        setSeries(sRes.series ?? []);
      })
      .catch(() => { setBooks([]); setSeries([]); })
      .finally(() => setLoading(false));
  }, []);

  const langMatch = (l?: string) => {
    if (activeLang === 'all') return true;
    const lang = l || 'ar';
    return lang === activeLang || lang === 'both';
  };

  const filteredBooks = useMemo(() => {
    let list = books;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.title.toLowerCase().includes(q) ||
        (b.titleEn || '').toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q),
      );
    }
    if (activeLang !== 'all') list = list.filter(b => langMatch(b.language));
    return list;
  }, [books, search, activeLang]);

  const standaloneBooks   = useMemo(() => filteredBooks.filter(b => !b.seriesId && (!b.section || b.section === 'books')), [filteredBooks]);
  const standaloneStories = useMemo(() => filteredBooks.filter(b => !b.seriesId && b.section === 'stories'), [filteredBooks]);

  const filteredSeries = useMemo(() =>
    series.filter(s => activeLang === 'all' || langMatch(s.language)),
    [series, activeLang],
  );

  const isEmpty = filteredBooks.length === 0 && filteredSeries.length === 0;

  return (
    <div className="min-h-screen" style={{ background: '#F5F0E8' }} dir={isEn ? 'ltr' : 'rtl'}>

      {/* ── Sticky header: search + language pills ── */}
      <div
        className="sticky top-16 z-30 px-4 pt-3 pb-3"
        style={{
          background: 'linear-gradient(180deg, #16122a 0%, #1e1a35 100%)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        }}
      >
        <div className="max-w-2xl mx-auto space-y-2.5">

          {/* Search */}
          <div className="relative">
            <svg
              className={`absolute ${isEn ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isEn ? 'Search books or authors…' : 'ابحث عن كتاب أو مؤلف…'}
              className={`w-full bg-white/10 border border-white/15 text-white placeholder:text-gray-500
                rounded-xl ${isEn ? 'pl-11 pr-10' : 'pr-11 pl-10'} py-2.5 text-sm
                outline-none focus:border-amber-400/60 focus:bg-white/15 transition-all`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className={`absolute ${isEn ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg leading-none`}
              >×</button>
            )}
          </div>

          {/* Language pills */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {LANG_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setActiveLang(opt.id)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-200 ${
                  activeLang === opt.id
                    ? 'bg-amber-400 text-[#1a1a2e]'
                    : 'bg-white/10 text-gray-300 hover:bg-white/18 hover:text-white'
                }`}
              >
                <span className="text-sm leading-none">{opt.flag}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Gradient transition dark → cream ── */}
      <div className="h-8" style={{ background: 'linear-gradient(180deg, #1e1a35 0%, #F5F0E8 100%)' }} />

      {/* ── Shelves ── */}
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-20">

        {loading ? (
          <div className="space-y-12">
            {[1, 2, 3].map(i => (
              <div key={i}>
                <div className="h-4 w-32 bg-gray-300/60 rounded-full mb-5 animate-pulse" />
                <div className="flex gap-3 pb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="shrink-0 w-[84px] h-[126px] bg-gray-300/50 rounded animate-pulse" />
                  ))}
                </div>
                <div className="h-2.5 rounded-full bg-[#C8B49A]/40 animate-pulse" />
              </div>
            ))}
          </div>

        ) : isEmpty ? (
          <div className="text-center py-24">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-gray-500 font-bold mb-3">
              {search ? `لا نتائج لـ "${search}"` : isEn ? 'No books found' : 'لا توجد كتب'}
            </p>
            {(search || activeLang !== 'all') && (
              <button
                onClick={() => { setSearch(''); setActiveLang('all'); }}
                className="text-sm text-amber-600 underline"
              >
                {isEn ? 'Clear filters' : 'مسح الفلاتر'}
              </button>
            )}
          </div>

        ) : (
          <>
            {/* Series — one shelf each */}
            {filteredSeries.map((s, idx) => {
              const sBooks = s.books.filter(b => {
                if (search.trim()) {
                  const q = search.toLowerCase();
                  if (!b.title.toLowerCase().includes(q) && !(b.titleEn || '').toLowerCase().includes(q)) return false;
                }
                return activeLang === 'all' || langMatch(b.language);
              });
              const name = isEn && s.nameEn ? s.nameEn : s.name;
              return (
                <Shelf
                  key={s.id}
                  title={name}
                  books={sBooks}
                  isEn={isEn}
                  getPrice={getPrice}
                  color={SHELF_COLORS[idx % SHELF_COLORS.length]}
                />
              );
            })}

            {/* Standalone books */}
            <Shelf
              title={isEn ? 'Books & Novels' : 'كتب وروايات'}
              books={standaloneBooks}
              isEn={isEn}
              getPrice={getPrice}
              color="#B8A078"
            />

            {/* Standalone stories */}
            <Shelf
              title={isEn ? 'Educational Stories' : 'قصص تربوية'}
              books={standaloneStories}
              isEn={isEn}
              getPrice={getPrice}
              color="#A89070"
            />
          </>
        )}
      </div>
    </div>
  );
}
