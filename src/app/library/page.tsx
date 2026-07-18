'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  category?: string;
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
  author?: string;
  authorEn?: string;
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
  { id: 'all', label: 'الكل',       flag: '🌐' },
  { id: 'ar',  label: 'عربي',       flag: '🇸🇦' },
  { id: 'en',  label: 'English',    flag: '🇬🇧' },
  { id: 'ur',  label: 'اردو',       flag: '🇵🇰' },
  { id: 'id',  label: 'Indonesia',  flag: '🇮🇩' },
  { id: 'de',  label: 'Deutsch',    flag: '🇩🇪' },
  { id: 'fr',  label: 'Français',   flag: '🇫🇷' },
];

function BookSpine({ book, href, price, isEn }: {
  book: { cover: string; title: string; titleEn?: string; freePages: number; language?: string };
  href: string;
  price: string;
  isEn: boolean;
}) {
  const title = isEn && book.titleEn ? book.titleEn : book.title;
  return (
    <Link href={href} className="group shrink-0 flex flex-col items-center" style={{ width: 110 }}>
      {/* Book standing upright */}
      <div className="relative w-[88px] h-[132px] transition-transform duration-300 ease-out group-hover:-translate-y-3"
        style={{ transformStyle: 'preserve-3d' }}>

        {/* Book cover */}
        <div className="absolute inset-0 rounded-sm overflow-hidden bg-gradient-to-br from-[#2a1a4e] to-[#1a0a2e]"
          style={{
            boxShadow: '4px 6px 16px rgba(0,0,0,0.35), inset -3px 0 6px rgba(0,0,0,0.2)',
          }}>
          {book.cover ? (
            <Image src={book.cover} alt={title} fill className="object-cover" unoptimized sizes="88px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30 text-3xl">📖</div>
          )}
          {/* Spine reflection */}
          <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/30 to-transparent pointer-events-none" />
        </div>

        {/* Free preview badge */}
        {book.freePages > 0 && (
          <div className="absolute -top-2 -right-2 z-10 bg-amber-400 text-[#1a1a2e] text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm leading-tight">
            {isEn ? 'FREE' : 'مجاني'}
          </div>
        )}

        {/* Language badge */}
        {book.language && book.language !== 'ar' && (
          <div className="absolute bottom-1 left-1 z-10 text-[8px] bg-black/60 text-white px-1 py-0.5 rounded font-bold">
            {book.language === 'both' ? 'AR/EN' : book.language.toUpperCase()}
          </div>
        )}
      </div>

      {/* Book info below */}
      <div className="mt-2 w-full text-center px-1">
        <p className="text-[11px] font-bold text-gray-700 leading-tight line-clamp-2 group-hover:text-amber-700 transition-colors">
          {title}
        </p>
        <p className="text-[11px] font-black text-amber-600 mt-0.5">{price}</p>
      </div>
    </Link>
  );
}

function Shelf({ title, subtitle, books, isEn, getPrice, shelfColor = '#C8B49A' }: {
  title: string;
  subtitle?: string;
  books: Array<{ id: string; cover: string; title: string; titleEn?: string; price: number; priceUSD?: number; freePages: number; language?: string }>;
  isEn: boolean;
  getPrice: (b: { price: number; priceUSD?: number }) => string;
  shelfColor?: string;
}) {
  if (books.length === 0) return null;

  return (
    <div className="mb-10">
      {/* Shelf label */}
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 className="text-lg font-black text-gray-800 leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
          {books.length} {isEn ? 'books' : 'كتاب'}
        </span>
      </div>

      {/* Scrollable book row */}
      <div className="relative">
        <div
          className="flex gap-4 overflow-x-auto pb-5 px-2 scrollbar-none"
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
          {/* Padding at end */}
          <div className="shrink-0 w-2" />
        </div>

        {/* Shelf plank */}
        <div
          className="h-3 rounded-full mx-2"
          style={{
            background: `linear-gradient(180deg, ${shelfColor} 0%, #A8926E 100%)`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        />
        {/* Shelf shadow */}
        <div className="h-2 mx-6 rounded-full mt-0.5"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, transparent 70%)' }} />
      </div>
    </div>
  );
}

export default function LibraryV2Page() {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const { zone, countryCode, formatPrice } = useRegionalPricing();

  const getPrice = (b: { price: number; priceUSD?: number }) => {
    if (b.price === 0) return isEn ? 'Free' : 'مجاني';
    return formatPrice(resolvePrice(b.price, b.priceUSD ?? 0, zone, countryCode));
  };

  const [books, setBooks] = useState<Book[]>([]);
  const [series, setSeries] = useState<BookSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  const langMatch = useCallback((bookLang?: string) => {
    if (activeLang === 'all') return true;
    const l = bookLang || 'ar';
    return l === activeLang || l === 'both';
  }, [activeLang]);

  // Filter books by search + language
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
    if (activeLang !== 'all') {
      list = list.filter(b => langMatch(b.language));
    }
    return list;
  }, [books, search, activeLang, langMatch]);

  // Standalone books (no series) — split by section
  const standaloneBooks = useMemo(() =>
    filteredBooks.filter(b => !b.seriesId && (!b.section || b.section === 'books')),
    [filteredBooks]);

  const standaloneStories = useMemo(() =>
    filteredBooks.filter(b => !b.seriesId && b.section === 'stories'),
    [filteredBooks]);

  // Series filtered by language
  const filteredSeries = useMemo(() =>
    series.filter(s => {
      if (activeLang === 'all') return true;
      return langMatch(s.language);
    }),
    [series, activeLang]);

  const shelfColors = [
    '#C8B49A', '#B8A88A', '#D4C0A0', '#C0AC90',
    '#BAA888', '#CCC0A8', '#B4A282', '#CCB898',
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F5F0E8' }} dir={isEn ? 'ltr' : 'rtl'}>

      {/* ── Hero ── */}
      <div
        className="relative px-4 overflow-hidden"
        style={{
          minHeight: '65vh',
          display: 'flex',
          alignItems: 'center',
          paddingTop: '5rem',
          backgroundImage: 'url(/Digital-Liberary-hero-image.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#0d0d1a]/65" />
        {/* Bottom fade to cream */}
        <div className="absolute bottom-0 left-0 right-0 h-20"
          style={{ background: 'linear-gradient(to bottom, transparent, #F5F0E8)' }} />

        <div className="relative z-10 max-w-2xl mx-auto text-center w-full pb-10">
          <p className="text-amber-400 text-xs font-black tracking-widest uppercase mb-3">
            {isEn ? 'Digital Library' : 'المكتبة الرقمية'}
          </p>
          <h1 className="text-white font-black text-3xl sm:text-4xl mb-6 drop-shadow-lg">
            {isEn ? 'Read. Learn. Rise.' : 'اقرأ. وتفقّه. وارتقِ.'}
          </h1>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <svg className={`absolute ${isEn ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isEn ? 'Search books...' : 'ابحث عن كتاب أو مؤلف...'}
              className={`w-full bg-white/15 backdrop-blur-sm border border-white/25 text-white placeholder:text-gray-300
                rounded-2xl ${isEn ? 'pl-11 pr-4' : 'pr-11 pl-4'} py-3.5 text-sm
                outline-none focus:border-amber-400/70 focus:bg-white/20 transition`}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className={`absolute ${isEn ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-300 hover:text-white text-xl leading-none`}>
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Language Filters ── */}
      <div className="sticky top-16 z-20 px-4 py-3"
        style={{ background: 'rgba(245, 240, 232, 0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="shrink-0 text-[11px] font-black text-gray-400 uppercase tracking-widest me-1">
              {isEn ? 'Language:' : 'اللغة:'}
            </span>
            {LANG_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setActiveLang(opt.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                  activeLang === opt.id
                    ? 'bg-[#1a1a2e] text-amber-400 shadow-md scale-105'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-amber-300 hover:text-amber-700'
                }`}
              >
                <span className="text-sm leading-none">{opt.flag}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Shelves ── */}
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">

        {loading ? (
          /* Skeleton */
          <div className="space-y-10">
            {[1, 2, 3].map(i => (
              <div key={i}>
                <div className="h-5 w-40 bg-gray-200 rounded-full mb-4 animate-pulse" />
                <div className="flex gap-4 pb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="shrink-0 w-[88px] h-[132px] bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
                <div className="h-3 rounded-full bg-[#C8B49A]/40 animate-pulse" />
              </div>
            ))}
          </div>

        ) : filteredBooks.length === 0 && filteredSeries.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-gray-500 font-bold text-lg mb-2">
              {search ? `لا نتائج لـ "${search}"` : 'لا توجد كتب'}
            </p>
            {(search || activeLang !== 'all') && (
              <button onClick={() => { setSearch(''); setActiveLang('all'); }}
                className="text-sm text-amber-600 underline mt-2">
                {isEn ? 'Clear filters' : 'مسح الفلاتر'}
              </button>
            )}
          </div>

        ) : (
          <>
            {/* Series shelves — one per series */}
            {filteredSeries.map((s, idx) => {
              const sBooks = s.books.filter(b => {
                if (search.trim()) {
                  const q = search.toLowerCase();
                  if (!(b.title.toLowerCase().includes(q) || (b.titleEn || '').toLowerCase().includes(q))) return false;
                }
                if (activeLang !== 'all') return langMatch(b.language);
                return true;
              });
              if (sBooks.length === 0) return null;
              const name = isEn && s.nameEn ? s.nameEn : s.name;
              const color = shelfColors[idx % shelfColors.length];
              return (
                <Shelf
                  key={s.id}
                  title={name}
                  subtitle={s.description ? s.description.slice(0, 60) + (s.description.length > 60 ? '…' : '') : undefined}
                  books={sBooks}
                  isEn={isEn}
                  getPrice={getPrice}
                  shelfColor={color}
                />
              );
            })}

            {/* Standalone books shelf */}
            {standaloneBooks.length > 0 && (
              <Shelf
                title={isEn ? 'Books & Novels' : 'كتب وروايات'}
                books={standaloneBooks}
                isEn={isEn}
                getPrice={getPrice}
                shelfColor="#B8A078"
              />
            )}

            {/* Standalone stories shelf */}
            {standaloneStories.length > 0 && (
              <Shelf
                title={isEn ? 'Educational Stories' : 'قصص تربوية'}
                books={standaloneStories}
                isEn={isEn}
                getPrice={getPrice}
                shelfColor="#A89070"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
