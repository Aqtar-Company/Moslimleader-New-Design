'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';
import { formatAgeLabel } from '@/lib/book-age';

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
  freePages: number;
  totalPages: number;
  minAge?: number | null;
  maxAge?: number | null;
  needsParentalGuide?: boolean;
  _count: { accesses: number };
}

type SectionTab = 'books' | 'stories';
type LangFilter = 'ar' | 'en' | 'fr' | 'hi' | null;

const LANG_OPTIONS: { id: Exclude<LangFilter, null>; label: string; labelEn: string; flag: React.ReactNode }[] = [
  {
    id: 'ar', label: 'عربي', labelEn: 'Arabic',
    flag: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 15" fill="none">
        <rect width="20" height="15" rx="2" fill="#006C35"/>
        <rect y="5" width="20" height="5" fill="white"/>
        <rect y="10" width="20" height="5" fill="black"/>
      </svg>
    ),
  },
  {
    id: 'en', label: 'إنجليزي', labelEn: 'English',
    flag: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 15" fill="none">
        <rect width="20" height="15" rx="2" fill="#012169"/>
        <path d="M0 0l20 15M20 0L0 15" stroke="white" strokeWidth="3"/>
        <path d="M0 0l20 15M20 0L0 15" stroke="#C8102E" strokeWidth="1.5"/>
        <path d="M10 0v15M0 7.5h20" stroke="white" strokeWidth="5"/>
        <path d="M10 0v15M0 7.5h20" stroke="#C8102E" strokeWidth="3"/>
      </svg>
    ),
  },
  {
    id: 'fr', label: 'فرنساوي', labelEn: 'French',
    flag: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 15" fill="none">
        <rect width="20" height="15" rx="2" fill="#ED2939"/>
        <rect width="7" height="15" rx="2" fill="#002395"/>
        <rect x="7" width="6" height="15" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'hi', label: 'هندي', labelEn: 'Hindi',
    flag: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 15" fill="none">
        <rect width="20" height="15" rx="2" fill="#138808"/>
        <rect width="20" height="5" rx="2" fill="#FF9933"/>
        <rect y="5" width="20" height="5" fill="white"/>
        <circle cx="10" cy="7.5" r="2" fill="none" stroke="#000080" strokeWidth="0.8"/>
      </svg>
    ),
  },
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

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<SectionTab>('books');
  const [activeLang, setActiveLang] = useState<LangFilter>('ar');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  useEffect(() => {
    fetch('/api/books')
      .then(r => r.json())
      .then(d => setBooks(d.books ?? []))
      .catch(() => setBooks([]))
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
      <div className="bg-[#1a1a2e] pt-28 pb-10 px-4">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <p className="text-[#F5C518] font-bold text-sm tracking-widest mb-3 uppercase">
            {isEn ? 'Digital Library' : 'المكتبة الرقمية'}
          </p>
          <h1 className="text-white font-black text-3xl sm:text-4xl mb-3">
            {isEn ? 'Read, Learn & Grow' : 'اقرأ، تعلّم، وانمُ'}
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            {isEn
              ? 'Curated books in leadership, self-development, and Islamic thought'
              : 'كتب منتقاة في القيادة، التطوير الذاتي، والفكر الإسلامي'}
          </p>
        </div>

        {/* Search */}
        <div className="max-w-lg mx-auto">
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
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
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

          {/* Language Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setLangDropdownOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-white/10 transition"
            >
              {activeLang && LANG_OPTIONS.find(l => l.id === activeLang)?.flag}
              <span>{activeLang ? (isEn ? LANG_OPTIONS.find(l => l.id === activeLang)?.labelEn : LANG_OPTIONS.find(l => l.id === activeLang)?.label) : (isEn ? 'Language' : 'اللغة')}</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
                    {opt.flag}
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
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          unoptimized
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <svg className="w-12 h-12 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                          </svg>
                        </div>
                      )}
                      {/* Language badge */}
                      {book.language === 'en' && (
                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">EN</div>
                      )}
                      {book.language === 'both' && (
                        <div className="absolute top-2 left-2 bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">AR/EN</div>
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
                          {book.price === 0
                            ? (isEn ? 'Free' : 'مجاني')
                            : `${book.price.toLocaleString(isEn ? 'en-EG' : 'ar-EG')} ${isEn ? 'EGP' : 'ج.م'}`}
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
          </>
        )}
      </div>
    </div>
  );
}
