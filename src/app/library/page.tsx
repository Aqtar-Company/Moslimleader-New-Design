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
  author?: string;
  category?: string;
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
  const [sort, setSort] = useState<'newest' | 'popular' | 'price_asc' | 'price_desc'>('newest');

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
        (b.category || '').toLowerCase().includes(q),
      );
    }
    if (activeCategory) {
      list = list.filter(b => b.category === activeCategory);
    }
    switch (sort) {
      case 'popular':   return [...list].sort((a, b) => b._count.accesses - a._count.accesses);
      case 'price_asc': return [...list].sort((a, b) => a.price - b.price);
      case 'price_desc':return [...list].sort((a, b) => b.price - a.price);
      default:          return list;
    }
  }, [books, search, activeCategory, sort]);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Hero */}
      <div className="bg-[#1a1a2e] pt-28 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <p className="text-[#F5C518] font-bold text-sm tracking-widest mb-3 uppercase">المكتبة الرقمية</p>
          <h1 className="text-white font-black text-3xl sm:text-4xl mb-3">اقرأ، تعلّم، وانمُ</h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            كتب منتقاة في القيادة، التطوير الذاتي، والفكر الإسلامي
          </p>
        </div>

        {/* Search bar */}
        <div className="max-w-lg mx-auto">
          <div className="relative">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن كتاب أو مؤلف..."
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-gray-400 rounded-2xl pr-12 pl-4 py-3.5 text-sm outline-none focus:border-[#F5C518]/60 focus:bg-white/15 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg"
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
          {/* Category chips */}
          <button
            onClick={() => setActiveCategory('')}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition ${
              !activeCategory
                ? 'bg-[#1a1a2e] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            الكل {!loading && `(${books.length})`}
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
            <option value="newest">الأحدث</option>
            <option value="popular">الأكثر قراءة</option>
            <option value="price_asc">السعر: من الأقل</option>
            <option value="price_desc">السعر: من الأعلى</option>
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
              {search ? `لا توجد نتائج لـ "${search}"` : 'لا توجد كتب بعد'}
            </p>
            {(search || activeCategory) && (
              <button
                onClick={() => { setSearch(''); setActiveCategory(''); }}
                className="text-sm text-[#F5C518] underline mt-2"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        ) : (
          <>
            {(search || activeCategory) && (
              <p className="text-xs text-gray-400 mb-4">{filtered.length} نتيجة</p>
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
                          alt={book.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          unoptimized
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-5xl">📖</span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-[#F5C518] text-[#1a1a2e] text-[10px] font-black px-2 py-0.5 rounded-full">
                        {book.freePages} ص مجانية
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-black text-gray-900 text-sm leading-tight line-clamp-2 mb-1 flex-1">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="text-gray-400 text-xs mb-1">{book.author}</p>
                      )}
                      {book.category && (
                        <span className="inline-block text-[10px] text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 mb-2 w-fit font-semibold">
                          {book.category}
                        </span>
                      )}
                      <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-50">
                        <span className="font-black text-[#1a1a2e] text-sm">
                          {book.price === 0 ? (
                            <span className="text-green-600">مجاني</span>
                          ) : `${book.price.toLocaleString('ar-EG')} ج`}
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
