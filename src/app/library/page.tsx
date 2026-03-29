'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetch('/api/books')
      .then(r => r.json())
      .then(d => setBooks(d.books ?? []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Hero */}
      <div className="bg-[#1a1a2e] pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#F5C518] font-bold text-sm tracking-widest mb-3 uppercase">المكتبة الرقمية</p>
          <h1 className="text-white font-black text-3xl sm:text-4xl mb-4">
            اقرأ، تعلّم، وانمُ
          </h1>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            كتب منتقاة في القيادة، التطوير الذاتي، والفكر الإسلامي — أول فصول مجانية لكل كتاب
          </p>
        </div>
      </div>

      {/* Books grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
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
        ) : books.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-5xl mb-4">📚</p>
            <p className="font-semibold text-lg">لا توجد كتب منشورة بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {books.map(book => (
              <Link key={book.id} href={`/library/${book.id}`} className="group">
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300">
                  {/* Cover */}
                  <div className="relative aspect-[2/3] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] overflow-hidden">
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
                    {/* Free badge */}
                    <div className="absolute top-2 right-2 bg-[#F5C518] text-[#1a1a2e] text-[10px] font-black px-2 py-0.5 rounded-full">
                      {book.freePages} صفحة مجانية
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="font-black text-gray-900 text-sm leading-tight line-clamp-2 mb-1">
                      {book.title}
                    </h3>
                    {book.author && (
                      <p className="text-gray-400 text-xs mb-2">{book.author}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[#1a1a2e] text-sm">
                        {book.price === 0 ? 'مجاني' : `${book.price.toLocaleString('ar-EG')} ج`}
                      </span>
                      <span className="text-xs text-gray-400">
                        {book._count.accesses} قارئ
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
