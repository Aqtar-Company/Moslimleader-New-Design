'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { products, categories } from '@/lib/products';
import ProductCard from '@/components/product/ProductCard';
import { useLang } from '@/context/LanguageContext';

function ShopContent() {
  const searchParams = useSearchParams();
  const { t } = useLang();
  const initialCategory = searchParams.get('category') || 'all';
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [search, setSearch] = useState('');

  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = p.name.includes(search) || p.shortDescription.includes(search);
    return matchCat && matchSearch;
  });

  return (
    <>
      {/* Banner */}
      <div className="bg-[#F5C518] py-10 text-center">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900">{t('shop.title')}</h1>
        <p className="text-gray-700 mt-2">{t('shop.subtitle')}</p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Search */}
        <div className="mb-8 max-w-md mx-auto">
          <div className="relative">
            <input
              type="text"
              placeholder={t('shop.search.ph')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 pr-10 outline-none text-right"
            />
            <svg className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-full border-2 font-semibold text-sm transition ${
                activeCategory === cat.id
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'border-gray-200 hover:border-gray-900 text-gray-700'
              }`}
            >
              {t(`cat.${cat.id}` as Parameters<typeof t>[0]) || cat.name}
              <span className={`text-xs font-bold px-1.5 rounded-full ${activeCategory === cat.id ? 'bg-white text-gray-900' : 'bg-gray-100'}`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-gray-500 text-sm mb-6">
          {filtered.length} {t('shop.results')}
        </p>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg font-semibold">{t('shop.empty')}</p>
          </div>
        )}
      </div>
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense>
      <ShopContent />
    </Suspense>
  );
}
