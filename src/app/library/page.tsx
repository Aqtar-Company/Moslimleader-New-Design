'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';
import { formatAgeLabel } from '@/lib/book-age';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { resolvePrice } from '@/lib/geo-pricing';

interface Book {
  id: string;
  title: string;
  titleEn?: string;
  cover: string;
  description: string;
  descriptionEn?: string;
  author?: string;
  authorEn?: string;
  category?: string;
  language?: string;
  section?: string; // 'books' | 'stories'
  price: number;
  priceUSD?: number;
  freePages: number;
  totalPages: number;
  minAge?: number | null;
  maxAge?: number | null;
  needsParentalGuide?: boolean;
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
  descriptionEn?: string;
  cover?: string;
  seriesPrice?: number;
  seriesPriceUSD?: number;
  language?: string;
  books: SeriesBook[];
}

type SectionTab = 'books' | 'stories';
type LangFilter = 'ar' | 'en' | 'ur' | 'id' | 'bn' | 'hi' | 'de' | 'fr' | null;

const LANG_OPTIONS: { id: Exclude<LangFilter, null>; label: string; labelEn: string }[] = [
  { id: 'ar', label: 'عربي',      labelEn: 'Arabic'     },
  { id: 'en', label: 'إنجليزي',   labelEn: 'English'    },
  { id: 'ur', label: 'اردو',      labelEn: 'Urdu'       },
  { id: 'id', label: 'Indonesia', labelEn: 'Indonesian' },
  { id: 'bn', label: 'বাংলা',     labelEn: 'Bengali'    },
  { id: 'de', label: 'ألماني',    labelEn: 'German'     },
  { id: 'fr', label: 'فرنساوي',   labelEn: 'French'     },
];

const TABS: { id: SectionTab; ar: string; en: string; icon: React.ReactNode }[] = [
  {
    id: 'books',
    ar: 'كتب وروايات',
    en: 'Books & Novels',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    id: 'stories',
    ar: 'قصص تربوية',
    en: 'Educational Stories',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
  },
];

export default function LibraryPage() {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const { zone, countryCode, formatPrice } = useRegionalPricing();

  // Helper: resolve and format book price based on user region
  const getBookPrice = (book: { price: number; priceUSD?: number }) => {
    if (book.price === 0) return isEn ? 'Free' : 'مجاني';
    const pricing = book.priceUSD ? { price_usd_manual: book.priceUSD } : null;
    return formatPrice(resolvePrice(book.price, zone, pricing, countryCode));
  };

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<SectionTab>('books');
  const [activeLang, setActiveLang] = useState<LangFilter>('ar');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const [seriesData, setSeriesData] = useState<BookSeriesData[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/books').then(r => r.json()),
      fetch('/api/series').then(r => r.json()),
    ])
      .then(([booksRes, seriesRes]) => {
        setBooks(booksRes.books ?? []);
        setSeriesData(seriesRes.series ?? []);
      })
      .catch(() => { setBooks([]); setSeriesData([]); })
      .finally(() => setLoading(false));
  }, []);

  // Count per tab
  const counts = useMemo(() => ({
    books: books.filter(b => !b.section || b.section === 'books').length,
    stories: books.filter(b => b.section === 'stories').length,
  }), [books]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = books.filter(b => {
      const s = b.section || 'books';
      return s === activeTab;
    });
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(b =>
        b.title.toLowerCase().includes(q) ||
        (b.titleEn || '').toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q) ||
        (b.authorEn || '').toLowerCase().includes(q),
      );
    }
    if (activeLang) {
      list = list.filter(b => {
        const l = b.language || 'ar';
        return l === activeLang || l === 'both';
      });
    }
    return list;
  }, [books, search, activeTab, activeLang]);

  const getBookTitle  = (b: Book) => isEn && b.titleEn  ? b.titleEn  : b.title;
  const getBookAuthor = (b: Book) => isEn && b.authorEn ? b.authorEn : b.author;

  return (
    <div className="min-h-screen bg-gray-50" dir={isEn ? 'ltr' : 'rtl'}>

      {/* ── Hero ── */}
      <div
        className="relative pt-28 pb-10 px-4 overflow-hidden"
        style={{
          backgroundImage: 'url(/library-hero.jpg), url(/reading-boy-hero.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#0d0d1a]/70" />
        <div className="relative z-10 max-w-4xl mx-auto text-center mb-8">
          <p className="text-[#F5C518] font-bold text-sm tracking-widest mb-3 uppercase">
            {isEn ? 'Digital Library' : 'المكتبة الرقمية'}
          </p>
          <h1 className="text-white font-black text-3xl sm:text-4xl mb-3">
            {isEn ? 'Read, Learn & Grow' : 'اقرأ، تعلّم، وانمُ'}
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            {isEn
              ? 'Educational & cultural content to build tomorrow\'s leaders | Righteous & reformers'
              : 'محتوى تربوي وثقافي لبناء قادة الغد | صالحون مصلحون'}
          </p>
        </div>

        {/* Search */}
        <div className="relative z-10 max-w-lg mx-auto">
          <div className="relative">
            <span className={`absolute ${isEn ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isEn ? 'Search for a book or author...' : 'ابحث عن كتاب أو مؤلف...'}
              className={`w-full bg-white/10 border border-white/20 text-white placeholder:text-gray-400 rounded-2xl ${isEn ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-3.5 text-sm outline-none focus:border-[#F5C518]/60 focus:bg-white/15 transition`}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className={`absolute ${isEn ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg`}>
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs + Language Dropdown ── */}
      <div className="bg-[#1a1a2e] border-b border-white/10 sticky top-16 z-20">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">

          {/* Tabs — row 1 on mobile */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-white/5 sm:border-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                className={`relative shrink-0 flex items-center gap-2 px-5 py-4 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#F5C518]'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.icon}
                {isEn ? tab.en : tab.ar}
                {counts[tab.id] > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-[#F5C518]/20 text-[#F5C518]' : 'bg-white/10 text-gray-400'
                  }`}>
                    {counts[tab.id]}
                  </span>
                )}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F5C518] rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* Language Dropdown — row 2 on mobile */}
          <div className="relative shrink-0 flex flex-col gap-1 py-2 sm:py-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
              {isEn ? 'Book Language' : 'اختار لغة الكتاب'}
            </span>
            <button
              onClick={() => setLangDropdownOpen(o => !o)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                activeLang
                  ? 'bg-[#F5C518] text-[#1a1a2e] border-[#F5C518]'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
              </svg>
              <span>
                {activeLang
                  ? (isEn ? LANG_OPTIONS.find(l => l.id === activeLang)?.labelEn : LANG_OPTIONS.find(l => l.id === activeLang)?.label)
                  : (isEn ? 'Select Book Language' : 'اختار لغة الكتاب')
                }
              </span>
              <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {langDropdownOpen && (
              <div className={`absolute ${isEn ? 'right-0' : 'left-0'} top-full mt-1 bg-[#1e2040] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 min-w-[140px]`}>
                {/* اختر اللغة header */}
                <div className="px-3 py-2 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/10">
                  {isEn ? 'Select Language' : 'اختر اللغة'}
                </div>
                {LANG_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setActiveLang(activeLang === opt.id ? null : opt.id); setLangDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition ${
                      activeLang === opt.id
                        ? 'bg-[#F5C518]/20 text-[#F5C518] font-bold'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {isEn ? opt.labelEn : opt.label}
                    {activeLang === opt.id && (
                      <svg className="w-3.5 h-3.5 ms-auto" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Books Grid ── */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-[2/3] bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="flex justify-center mb-4">
              {TABS.find(t => t.id === activeTab)?.icon && (
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              )}
            </div>
            <p className="font-bold text-lg mb-1 text-gray-500">
              {search
                ? (isEn ? `No results for "${search}"` : `لا توجد نتائج لـ "${search}"`)
                : (isEn
                    ? `No ${activeTab === 'books' ? 'books' : 'stories'} yet`
                    : `لا توجد ${activeTab === 'books' ? 'كتب' : 'قصص'} بعد`)}
            </p>
            {(search || activeLang) && (
              <button
                onClick={() => { setSearch(''); setActiveLang(null); }}
                className="text-sm text-[#F5C518] underline mt-2"
              >
                {isEn ? 'Clear filters' : 'مسح الفلاتر'}
              </button>
            )}
          </div>
        ) : (
          <>
            {(search || activeLang) && (
              <p className="text-xs text-gray-400 mb-4">
                {filtered.length} {isEn ? 'results' : 'نتيجة'}
              </p>
            )}
            {/* Stories tab: show series groups, then standalone books */}
            {activeTab === 'stories' && !search && seriesData.length > 0 ? (
              <div className="space-y-10">
                {seriesData
                  .filter(s => {
                    if (!activeLang) return true;
                    return s.language === activeLang || s.language === 'both';
                  })
                  .map(series => {
                    const seriesBooks = series.books.filter(b => {
                      if (!activeLang) return true;
                      const l = b.language || 'ar';
                      return l === activeLang || l === 'both';
                    });
                    if (seriesBooks.length === 0) return null;
                    const seriesName = isEn && series.nameEn ? series.nameEn : series.name;
                    const seriesDesc = isEn && series.descriptionEn ? series.descriptionEn : series.description;
                    return (
                      <div key={series.id} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] px-6 py-5 flex items-center gap-4">
                          {series.cover && (
                            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-[#F5C518]/30">
                              <Image src={series.cover} alt={seriesName} width={56} height={56} className="w-full h-full object-cover" unoptimized />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[#F5C518] text-xs font-bold uppercase tracking-wider">
                                {isEn ? 'Series' : 'سلسلة'}
                              </span>
                              <span className="text-white/30 text-xs">•</span>
                              <span className="text-white/60 text-xs">{seriesBooks.length} {isEn ? 'stories' : 'قصة'}</span>
                            </div>
                            <h2 className="text-white font-black text-xl mt-0.5">{seriesName}</h2>
                            {seriesDesc && <p className="text-gray-400 text-xs mt-1 line-clamp-1">{seriesDesc}</p>}
                          </div>
                          {series.seriesPrice && (
                            <div className="shrink-0 text-right">
                              <p className="text-gray-400 text-xs">{isEn ? 'Full series' : 'السلسلة كاملة'}</p>
                              <p className="text-[#F5C518] font-black text-lg">
                                {formatPrice(resolvePrice(series.seriesPrice ?? 0, zone, { price_egp_manual: series.seriesPrice, price_usd_manual: series.seriesPriceUSD }, countryCode))}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
                            {seriesBooks.map((b, idx) => (
                              <Link key={b.id} href={`/library/${b.id}`} className="group">
                                <div className="bg-gray-50 rounded-2xl overflow-hidden hover:shadow-md transition-shadow duration-300 flex flex-col">
                                  <div className="relative aspect-[2/3] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] overflow-hidden shrink-0">
                                    {b.cover ? (
                                      <Image src={b.cover} alt={isEn && b.titleEn ? b.titleEn : b.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                                    ) : (
                                      <div className="flex items-center justify-center h-full text-white/30 text-3xl">📖</div>
                                    )}
                                    <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#F5C518] text-[#1a1a2e] text-[10px] font-black flex items-center justify-center shadow">
                                      {b.seriesOrder || idx + 1}
                                    </div>
                                  </div>
                                  <div className="p-2">
                                    <p className="text-xs font-bold text-gray-800 leading-tight line-clamp-2">
                                      {isEn && b.titleEn ? b.titleEn : b.title}
                                    </p>
                                    <p className="text-[#F5C518] font-black text-xs mt-1">
                                      {getBookPrice(b)}
                                    </p>
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {filtered.filter(b => !b.seriesId).length > 0 && (
                  <div>
                    <h2 className="text-lg font-black text-gray-800 mb-4">
                      {isEn ? 'Other Stories' : 'قصص أخرى'}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                      {filtered.filter(b => !b.seriesId).map(book => (
                        <Link key={book.id} href={`/library/${book.id}`} className="group">
                          <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                            <div className="relative aspect-[2/3] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] overflow-hidden shrink-0">
                              {book.cover ? (
                                <Image
                                  src={book.cover}
                                  alt={getBookTitle(book)}
                                  fill
                                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                  quality={80}
                                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full text-white/30 text-4xl">📖</div>
                              )}
                            </div>
                            <div className="p-3 flex flex-col gap-1 flex-1">
                              <h3 className="font-black text-gray-900 text-sm leading-tight line-clamp-2">{getBookTitle(book)}</h3>
                              <div className="mt-auto pt-2">
                                <span className="text-[#F5C518] font-black text-sm">
                                  {getBookPrice(book)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {filtered.map(book => (
                <Link key={book.id} href={`/library/${book.id}`} className="group">
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                    {/* Cover */}
                    <div className="relative aspect-[2/3] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] overflow-hidden shrink-0">
                      {book.cover ? (
                        <Image
                          src={book.cover}
                          alt={getBookTitle(book)}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          quality={80}
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <svg className="w-12 h-12 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                          </svg>
                        </div>
                      )}
                      {/* Language badge */}
                      {book.language && book.language !== 'ar' && (
                        <div className={`absolute top-2 left-2 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          book.language === 'en' ? 'bg-blue-600' :
                          book.language === 'ur' ? 'bg-emerald-700' :
                          book.language === 'id' ? 'bg-red-600' :
                          book.language === 'bn' ? 'bg-green-700' :
                          book.language === 'hi' ? 'bg-orange-600' :
                          book.language === 'de' ? 'bg-gray-800' :
                          book.language === 'fr' ? 'bg-indigo-700' :
                          book.language === 'both' ? 'bg-purple-600' :
                          'bg-gray-600'
                        }`}>
                          {book.language === 'en' ? 'EN' :
                           book.language === 'ur' ? 'UR' :
                           book.language === 'id' ? 'ID' :
                           book.language === 'bn' ? 'BN' :
                           book.language === 'hi' ? 'HI' :
                           book.language === 'de' ? 'DE' :
                           book.language === 'fr' ? 'FR' :
                           book.language === 'both' ? 'AR/EN' :
                           book.language.toUpperCase()}
                        </div>
                      )}
                      {/* Free preview badge */}
                      {book.freePages > 0 && (
                        <div className="absolute top-2 right-2 bg-[#F5C518] text-[#1a1a2e] text-[9px] font-black px-1.5 py-0.5 rounded-md">
                          {isEn ? 'FREE PREVIEW' : 'معاينة مجانية'}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <h3 className="font-black text-gray-900 text-sm leading-tight line-clamp-2">
                        {getBookTitle(book)}
                      </h3>
                      {getBookAuthor(book) && (
                        <p className="text-gray-500 text-xs">{getBookAuthor(book)}</p>
                      )}
                      {book.minAge != null && (
                        <span className="inline-block bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5">
                          {formatAgeLabel(book.minAge, book.maxAge ?? null, book.needsParentalGuide ?? false, isEn ? 'en' : 'ar')}
                        </span>
                      )}
                      <div className="mt-auto pt-2 flex items-center justify-between">
                        <span className="text-[#F5C518] font-black text-sm">
                          {getBookPrice(book)}
                        </span>
                        <span className="text-gray-400 text-xs flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {book._count.accesses}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
