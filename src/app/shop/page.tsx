'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { products, categories } from '@/lib/products';
import ProductCard from '@/components/product/ProductCard';
import { useLang } from '@/context/LanguageContext';

function ShopContent() {
  const searchParams = useSearchParams();
  const { t, isRtl } = useLang();
  const initialCategory = searchParams.get('category') || 'all';
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [search, setSearch] = useState('');

  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = isRtl
      ? p.name.includes(search) || p.shortDescription.includes(search)
      : (p.nameEn || p.name).toLowerCase().includes(search.toLowerCase()) ||
        (p.shortDescriptionEn || p.shortDescription).toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Search */}
      <div className="mb-8 max-w-md mx-auto">
        <div className="relative">
          <input
            type="text"
            placeholder={t('shop.search.ph')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 pr-10 outline-none ${isRtl ? 'text-right' : 'text-left'}`}
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
  );
}

export default function ShopPage() {
  const { t, lang } = useLang();
  const isRtl = lang === 'ar';

  return (
    <>
      {/* Hero */}
      <section className="bg-[#F5C518] overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 flex flex-col md:flex-row items-center gap-8" dir={isRtl ? 'rtl' : 'ltr'}>
          {/* Text side */}
          <div className={`flex-1 text-center ${isRtl ? 'md:text-right order-2 md:order-1' : 'md:text-left order-2 md:order-2'}`}>
            <div className={`flex items-center justify-center ${isRtl ? 'md:justify-end' : 'md:justify-start'} gap-3 mb-4`}>
              <Image
                src="https://moslimleader.com/wp-content/uploads/2024/07/Logo.webp"
                alt="Moslim Leader"
                width={120}
                height={48}
                className="h-12 w-auto object-contain"
                unoptimized
              />
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-gray-900 leading-tight mb-3">
              {t('home.hero.title')}
            </h1>
            <p className="text-xl md:text-2xl font-bold text-gray-800 mb-6">
              {t('home.hero.subtitle')}
            </p>
            <p className="text-gray-700 mb-8 max-w-md mx-auto md:mx-0">
              {t('home.hero.desc')}
            </p>
            <div className={`flex gap-3 justify-center ${isRtl ? 'md:justify-end' : 'md:justify-start'}`}>
              <Link
                href="/about"
                className="border-2 border-gray-900 hover:bg-gray-900 hover:text-white text-gray-900 font-bold px-8 py-3 rounded-xl transition"
              >
                {t('home.hero.aboutUs')}
              </Link>
            </div>
          </div>

          {/* Image side */}
          <div className={`flex-1 flex justify-center ${isRtl ? 'order-1 md:order-2' : 'order-1 md:order-1'}`}>
            <Image
              src="https://moslimleader.com/wp-content/uploads/2024/07/Asset-4-20.jpg"
              alt="Muslim Leader Products"
              width={500}
              height={400}
              className="w-full max-w-sm md:max-w-lg object-contain rounded-2xl"
              unoptimized
              priority
            />
          </div>
        </div>
      </section>

      {/* Shop content */}
      <Suspense>
        <ShopContent />
      </Suspense>
    </>
  );
}
