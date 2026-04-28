'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { products, categories } from '@/lib/products';
import { Product } from '@/types';
import ProductCard from '@/components/product/ProductCard';
import { useLang } from '@/context/LanguageContext';

/* ── Hero slideshow ─────────────────────────────────────────── */
const heroImages = [
  { src: '/family-hero.webp', alt: 'Moslim Leader Family' },
  { src: '/reading-boy-hero.webp', alt: 'Reading Boy' },
  { src: '/reading-girl-heero.webp', alt: 'Reading Girl' },
];

function HeroSlideshow() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % heroImages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {heroImages.map((img, i) => (
        <Image
          key={img.src}
          src={img.src}
          alt={img.alt}
          fill
          priority={i === 0}
          sizes="100vw"
          quality={85}
          className="object-cover object-center transition-opacity duration-1000"
          style={{ opacity: i === current ? 1 : 0, zIndex: 1 }}
        />
      ))}

      {/* Dot indicators */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2" style={{ zIndex: 4 }}>
        {heroImages.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-500 ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`}
          />
        ))}
      </div>
    </>
  );
}

/* ── Fade-in on scroll wrapper ──────────────────────────────── */
function FadeInSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="fade-section">
      {children}
    </div>
  );
}

/* ── Shop content ───────────────────────────────────────────── */
const PRODUCTS_CACHE_KEY = 'ml-products-v2';

function getCachedProducts(): Product[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (!parsed[0].id || !parsed[0].name) return null;
    return parsed;
  } catch { return null; }
}

function cacheProducts(items: Product[]) {
  try {
    const json = JSON.stringify(items);
    if (json.length > 2_000_000) return;
    localStorage.removeItem('ml-products-cache');
    localStorage.setItem(PRODUCTS_CACHE_KEY, json);
  } catch {}
}

function buildCategories(fetched: Product[]) {
  const staticUpdated = categories.map(cat =>
    cat.id === 'all'
      ? { ...cat, count: fetched.length }
      : { ...cat, count: fetched.filter(p => p.category === cat.id).length }
  );
  const existingIds = new Set(categories.map(c => c.id));
  const customEntries = fetched
    .map(p => p.category)
    .filter((c, i, arr) => !existingIds.has(c) && arr.indexOf(c) === i)
    .map(c => ({ id: c, name: c, count: fetched.filter(p => p.category === c).length }));
  return [...staticUpdated, ...customEntries];
}

function ShopContent() {
  const searchParams = useSearchParams();
  const { t, isRtl } = useLang();
  const initialCategory = searchParams.get('category') || 'all';
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [search, setSearch] = useState('');

  const cached = getCachedProducts();
  const [allProducts, setAllProducts] = useState<Product[]>(cached || []);
  const [displayCategories, setDisplayCategories] = useState(cached ? buildCategories(cached) : categories);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/products?_t=${Date.now()}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
        const data = await res.json();
        const fetched: Product[] = data.products ?? [];
        if (fetched.length > 0) {
          setAllProducts(fetched);
          setDisplayCategories(buildCategories(fetched));
          cacheProducts(fetched);
        }
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filtered = allProducts.filter(p => {
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
        {displayCategories.map(cat => (
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
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-5 bg-gray-200 rounded w-16" />
                  <div className="h-8 bg-gray-200 rounded-xl w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} priceLoading={false} />
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

/* ── Page ───────────────────────────────────────────────────── */
export default function ShopPage() {
  const { t, lang } = useLang();
  const isRtl = lang === 'ar';

  return (
    <>
      {/* ── Full-screen hero slideshow ── */}
      <section className="relative w-full h-screen overflow-hidden">
        <HeroSlideshow />

        {/* gradient: clear top → dark bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/75" style={{ zIndex: 2 }} />

        {/* text pinned to bottom */}
        <div
          className="absolute inset-x-0 bottom-24 flex flex-col items-center text-center px-6"
          style={{ zIndex: 3 }}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white drop-shadow-lg leading-tight">
            {t('home.hero.title')}
          </h1>
          <p className="text-white/80 mt-3 text-base sm:text-lg md:text-xl max-w-xl drop-shadow">
            {t('home.hero.subtitle')}
          </p>

          {/* Digital Library CTA */}
          <Link
            href="/library"
            className="mt-6 inline-flex items-center gap-2 bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            {isRtl ? 'اكتشف المكتبة الرقمية' : 'Explore Digital Library'}
            <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none animate-pulse">
              {isRtl ? 'جديد' : 'NEW'}
            </span>
          </Link>
        </div>

        {/* scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce" style={{ zIndex: 3 }}>
          <span className="text-white/60 text-xs tracking-widest uppercase">scroll</span>
          <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── Shop content with fade-in ── */}
      <FadeInSection>
        <Suspense>
          <ShopContent />
        </Suspense>
      </FadeInSection>
    </>
  );
}
