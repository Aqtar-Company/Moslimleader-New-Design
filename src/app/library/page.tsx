'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
  categoryEn?: string;
  language?: string; // 'ar' | 'en' | 'both'
  price: number;
  freePages: number;
  totalPages: number;
  _count: { accesses: number };
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeLang, setActiveLang] = useState<'all' | 'ar' | 'en'>('all');
  const [sort, setSort] = useState<'newest' | 'popular' | 'price_asc' | 'price_desc'>('newest');
  const [uiLang, setUiLang] = useState<'ar' | 'en'>('ar');

  const isEn = uiLang === 'en';

  useEffect(() => {
    fetch('/api/books')
      .then(r => r.json())
      .then(d => setBooks(d.books ?? []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  // Unique categories
  const categories = useMemo(() => {
    const cats = books.map(b => b.category).filter(Boolean) as string[];
    return [...new Set(cats)];
  }, [books]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = books;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(b =>
        b.title.toLowerCase().includes(q) ||
        (b.titleEn || '').toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q) ||
        (b.authorEn || '').toLowerCase().includes(q) ||
        (b.category || '').toLowerCase().includes(q),
      );
    }
    if (activeCategory) {
      list = list.filter(b => b.category === activeCategory);
    }
    if (activeLang !== 'all') {
      list = list.filter(b => {
        const lang = b.language || 'ar';
        return lang === activeLang || lang === 'both';
      });
    }
    switch (sort) {
      case 'popular':   return [...list].sort((a, b) => b._count.accesses - a._count.accesses);
      case 'price_asc': return [...list].sort((a, b) => a.price - b.price);
      case 'price_desc':return [...list].sort((a, b) => b.price - a.price);
      default:          return list;
    }
  }, [books, search, activeCategory, activeLang, sort]);

  const getBookTitle = (book: Book) => isEn && book.titleEn ? book.titleEn : book.title;
  const getBookAuthor = (book: Book) => isEn && book.authorEn ? book.authorEn : book.author;

  return (
    <div className="min-h-screen bg-gray-50" dir={isEn ? 'ltr' : 'rtl'}>
      {/* Hero */}
      <div className="bg-[#1a1a2e] pt-28 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center mb-8">
          {/* UI Language Toggle */}
          <div className="flex justify-center mb-5">
            <div className="inline-flex bg-white/10 rounded-2xl p-1 gap-1">
              <button
                onClick={() => setUiLang('ar')}
                className={`px-5 py-2 rounded-xl text-sm font-black transition ${uiLang === 'ar' ? 'bg-[#F5C518] text-[#1a1a2e]' : 'text-white/70 hover:text-white'}`}
              >
                العربية
              </button>
              <button
                onClick={() => setUiLang('en')}
                className={`px-5 py-2 rounded-xl text-sm font-black transition ${uiLang === 'en' ? 'bg-[#F5C518] text-[#1a1a2e]' : 'text-white/70 hover:text-white'}`}
              >
                English
              </button>
            </div>
          </div>

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

        {/* Search bar */}
        <div className="max-w-lg mx-auto">
          <div className="relative">
            <span className={`absolute ${isEn ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none`}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isEn ? 'Search for a book or author...' : 'ابحث عن كتاب أو مؤلف...'}
              className={`w-full bg-white/10 border border-white/20 text-white placeholder:text-gray-400 rounded-2xl ${isEn ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-3.5 text-sm outline-none focus:border-[#F5C518]/60 focus:bg-white/15 transition`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className={`absolute ${isEn ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg`}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="sticky top-16 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 overflow-x-auto scrollbar-none">
          {/* Language filter */}
          <button
            onClick={() => setActiveLang('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              activeLang === 'all'
                ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {isEn ? 'All Languages' : 'كل اللغات'}
          </button>
          <button
            onClick={() => setActiveLang('ar')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              activeLang === 'ar'
                ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            🇸🇦 {isEn ? 'Arabic' : 'عربي'}
          </button>
          <button
            onClick={() => setActiveLang('en')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              activeLang === 'en'
                ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            🇬🇧 {isEn ? 'English' : 'إنجليزي'}
          </button>

          <div className="w-px h-5 bg-gray-200 shrink-0" />

          {/* Category chips */}
          <button
            onClick={() => setActiveCategory('')}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition ${
              !activeCategory
                ? 'bg-[#F5C518] text-[#1a1a2e]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isEn ? `All (${!loading ? books.length : '...'})` : `الكل ${!loading ? `(${books.length})` : ''}`}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? '' : cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeCategory === cat
                  ? 'bg-[#F5C518] text-[#1a1a2e]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}

          <div className="flex-1" />

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="shrink-0 text-xs font-semibold text-gray-600 bg-gray-100 border-0 rounded-xl px-3 py-1.5 outline-none cursor-pointer"
          >
            <option value="newest">{isEn ? 'Newest' : 'الأحدث'}</option>
            <option value="popular">{isEn ? 'Most Read' : 'الأكثر قراءة'}</option>
            <option value="price_asc">{isEn ? 'Price: Low to High' : 'السعر: من الأقل'}</option>
            <option value="price_desc">{isEn ? 'Price: High to Low' : 'السعر: من الأعلى'}</option>
          </select>
        </div>
      </div>

      {/* Books grid */}
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
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">{search ? '🔍' : '📚'}</p>
            <p className="font-semibold text-lg mb-2">
              {search
                ? (isEn ? `No results for "${search}"` : `لا توجد نتائج لـ "${search}"`)
                : (isEn ? 'No books yet' : 'لا توجد كتب بعد')}
            </p>
            {(search || activeCategory || activeLang !== 'all') && (
              <button
                onClick={() => { setSearch(''); setActiveCategory(''); setActiveLang('all'); }}
                className="text-sm text-[#F5C518] underline mt-2"
              >
                {isEn ? 'Clear filters' : 'مسح الفلاتر'}
              </button>
            )}
          </div>
        ) : (
          <>
            {(search || activeCategory || activeLang !== 'all') && (
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
                          <span className="text-5xl">📖</span>
                        </div>
                      )}
                      {/* Language badge */}
                      {book.language === 'en' && (
                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                          EN
                        </div>
                      )}
                      {book.language === 'both' && (
                        <div className="absolute top-2 left-2 bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                          AR/EN
                        </div>
                      )}
                      <div className={`absolute top-2 ${isEn ? 'right-2' : 'right-2'} bg-[#F5C518] text-[#1a1a2e] text-[10px] font-black px-2 py-0.5 rounded-full`}>
                        {book.freePages} {isEn ? 'free' : 'ص مجانية'}
                      </div>
                    </div>

                    {/* Info */}
                    <div className={`p-3 flex flex-col flex-1 ${isEn && book.titleEn ? '' : ''}`} dir={isEn && book.titleEn ? 'ltr' : 'rtl'}>
                      <h3 className="font-black text-gray-900 text-sm leading-tight line-clamp-2 mb-1 flex-1">
                        {getBookTitle(book)}
                      </h3>
                      {getBookAuthor(book) && (
                        <p className="text-gray-400 text-xs mb-1">{getBookAuthor(book)}</p>
                      )}
                      {book.category && (
                        <span className="inline-block text-[10px] text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 mb-2 w-fit font-semibold">
                          {book.category}
                        </span>
                      )}
                      <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-50">
                        <span className="font-black text-[#1a1a2e] text-sm">
                          {book.price === 0 ? (
                            <span className="text-green-600">{isEn ? 'Free' : 'مجاني'}</span>
                          ) : isEn ? `${book.price} EGP` : `${book.price.toLocaleString('ar-EG')} ج`}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <span>👁</span> {book._count.accesses}
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
