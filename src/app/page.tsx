'use client';

import Image from 'next/image';
import Link from 'next/link';
import { products, categories, getFeaturedProducts } from '@/lib/products';
import ProductCard from '@/components/product/ProductCard';
import { useLang } from '@/context/LanguageContext';

export default function HomePage() {
  const { t } = useLang();
  const featured = getFeaturedProducts();
  const displayCategories = categories.filter(c => c.id !== 'all');

  return (
    <>
      {/* Hero */}
      <section className="bg-[#F5C518] overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 flex flex-col md:flex-row items-center gap-8">
          {/* Text side */}
          <div className="flex-1 text-center md:text-right order-2 md:order-1">
            <div className="flex items-center justify-center md:justify-end gap-3 mb-4">
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
            <div className="flex gap-3 justify-center md:justify-end">
              <Link
                href="/shop"
                className="bg-gray-900 hover:bg-gray-700 text-white font-bold px-8 py-3 rounded-xl transition"
              >
                {t('home.hero.shopNow')}
              </Link>
              <Link
                href="/about"
                className="border-2 border-gray-900 hover:bg-gray-900 hover:text-white text-gray-900 font-bold px-8 py-3 rounded-xl transition"
              >
                {t('home.hero.aboutUs')}
              </Link>
            </div>
          </div>

          {/* Image side */}
          <div className="flex-1 flex justify-center order-1 md:order-2">
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

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-8 text-center">
          {t('home.categories.title')}
        </h2>
        <div className="flex flex-wrap gap-3 justify-center">
          {displayCategories.map(cat => (
            <Link
              key={cat.id}
              href={`/shop?category=${encodeURIComponent(cat.id)}`}
              className="flex items-center gap-2 border-2 border-gray-200 hover:border-[#F5C518] hover:bg-[#FFF9E6] rounded-full px-5 py-2 transition group"
            >
              <span className="font-semibold text-gray-800 group-hover:text-gray-900">
                {t(`cat.${cat.id}` as Parameters<typeof t>[0]) || cat.name}
              </span>
              <span className="bg-gray-100 group-hover:bg-[#F5C518] text-gray-600 group-hover:text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full transition">
                {cat.count}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900">{t('home.featured.title')}</h2>
          <Link href="/shop" className="text-purple-700 hover:text-purple-900 font-semibold text-sm transition">
            {t('home.featured.viewAll')}
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {featured.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-10 text-center">{t('home.why.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: '📦', title: t('home.why.quality.title'), desc: t('home.why.quality.desc') },
              { icon: '🌟', title: t('home.why.content.title'), desc: t('home.why.content.desc') },
              { icon: '🚚', title: t('home.why.delivery.title'), desc: t('home.why.delivery.desc') },
            ].map(item => (
              <div key={item.title} className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="text-5xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-xl mb-2 text-gray-900">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All products teaser */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900">{t('home.all.title')}</h2>
          <Link href="/shop" className="text-purple-700 hover:text-purple-900 font-semibold text-sm transition">
            {t('home.all.viewAll')}
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.slice(0, 8).map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            href="/shop"
            className="inline-block bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-bold px-10 py-4 rounded-xl text-lg transition"
          >
            {t('home.all.cta')}
          </Link>
        </div>
      </section>
    </>
  );
}
