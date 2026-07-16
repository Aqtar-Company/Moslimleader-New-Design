'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { products as staticProducts, categories } from '@/lib/products';
import { Product } from '@/types';
import ProductCard from '@/components/product/ProductCard';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

const heroImages = [
  { src: '/family-hero.webp', alt: 'Moslim Leader Family' },
  { src: '/reading-boy-hero.webp', alt: 'Reading Boy' },
  { src: '/reading-girl-heero.webp', alt: 'Reading Girl' },
];

function HeroSlideshow() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCurrent(c => (c + 1) % heroImages.length), 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {heroImages.map((img, i) => (
        <Image key={img.src} src={img.src} alt={img.alt} fill priority={i === 0}
          sizes="100vw" quality={85}
          className="object-cover object-center transition-opacity duration-1000"
          style={{ opacity: i === current ? 1 : 0, zIndex: 1 }} />
      ))}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2" style={{ zIndex: 4 }}>
        {heroImages.map((_, i) => (
          <div key={i} className={`rounded-full transition-all duration-500 ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`} />
        ))}
      </div>
    </>
  );
}

function FadeInSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('is-visible'); observer.disconnect(); }
    }, { threshold: 0.08 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="fade-section">{children}</div>;
}

const CACHE_KEY = 'ml-products-v4';

function getCached(): Product[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, time } = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) return null;
    if (Date.now() - time > 30 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

function setCache(data: Product[]) {
  try {
    const json = JSON.stringify({ data, time: Date.now() });
    if (json.length < 2_000_000) localStorage.setItem(CACHE_KEY, json);
  } catch {}
}

function buildCategories(fetched: Product[]) {
  return categories.map(cat =>
    cat.id === 'all'
      ? { ...cat, count: fetched.length }
      : { ...cat, count: fetched.filter(p => p.category === cat.id).length }
  );
}

function expandProducts(products: Product[]) {
  const items: { product: Product; modelIndex?: number; key: string }[] = [];
  for (const p of products) {
    if (p.variants && p.variants.length > 0 && p.images && p.images.length > 1) {
      for (const v of p.variants) {
        if (v.imageIndex < p.images.length) {
          items.push({ product: p, modelIndex: v.imageIndex, key: `${p.id}-v${v.id}` });
        }
      }
    } else {
      items.push({ product: p, key: p.id });
    }
  }
  return items;
}

function ShopContent({ ssrProducts }: { ssrProducts?: Product[] }) {
  const searchParams = useSearchParams();
  const { t, isRtl } = useLang();
  const { user } = useAuth();
  const initialCategory = searchParams.get('category') || 'all';
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [ageFilter, setAgeFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState<'male' | 'female' | ''>('');
  const [search, setSearch] = useState('');
  const [showChildBanner, setShowChildBanner] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/children', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if ((d.children ?? []).length === 0) setShowChildBanner(true); })
      .catch(() => {});
  }, [user]);

  // Use SSR products if provided, otherwise fall back to localStorage cache then statics
  const cached = !ssrProducts ? getCached() : null;
  const [allProducts, setAllProducts] = useState<Product[]>(
    ssrProducts ?? cached ?? staticProducts,
  );
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    // If page was SSR'd with fresh products, persist them to cache and skip fetch
    if (ssrProducts && ssrProducts.length > 0) {
      setCache(ssrProducts);
      return;
    }
    // Fallback: client-side fetch (only when SSR products unavailable)
    let cancelled = false;
    setPriceLoading(true);
    fetch(`/api/products?_t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const fetched: Product[] = (data.products ?? []).filter(
          (p: Product) => p.images && p.images.length > 0
        );
        if (fetched.length > 0) {
          setAllProducts(fetched);
          setCache(fetched);
        }
        setPriceLoading(false);
      })
      .catch(() => { if (!cancelled) setPriceLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const AGE_GROUPS = [
    { id: '', label: isRtl ? 'كل الأعمار' : 'All Ages', desc: '' },
    { id: '4-7',   label: isRtl ? '٤–٧' : '4–7',   name: isRtl ? 'سن التمييز'  : 'Discernment', desc: isRtl ? 'غرس الحب والعادات الأولى باللعب والقصة المصوّرة' : 'Planting love and first habits through play and picture stories' },
    { id: '8-13',  label: isRtl ? '٨–١٣' : '8–13',  name: isRtl ? 'سن اليافعين' : 'Pre-teen',    desc: isRtl ? 'بناء المعرفة والمهارات وروح المسؤولية' : 'Building knowledge, skills and responsibility' },
    { id: '14-16', label: isRtl ? '١٤–١٦' : '14–16', name: isRtl ? 'سن التكليف'  : 'Accountability', desc: isRtl ? 'ترسيخ الهوية والثبات وفهم العبادات والواجبات' : 'Grounding identity, steadfastness and understanding of duties' },
    { id: '17-22', label: isRtl ? '١٧–٢٢' : '17–22', name: isRtl ? 'الشباب'      : 'Youth',       desc: isRtl ? 'الإمامة في الدين والدنيا، والقدوة، ونفع المجتمع' : 'Leadership in faith and life, being a role model' },
  ];

  const displayCategories = buildCategories(allProducts);
  const filtered = allProducts.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = isRtl
      ? p.name.includes(search) || p.shortDescription.includes(search)
      : (p.nameEn || p.name).toLowerCase().includes(search.toLowerCase()) ||
        (p.shortDescriptionEn || p.shortDescription).toLowerCase().includes(search.toLowerCase());
    let matchAge = true;
    if (ageFilter) {
      const [lo, hi] = ageFilter.split('-').map(Number);
      const min = p.minAge ?? 0;
      const max = p.maxAge ?? 99;
      matchAge = min <= hi && max >= lo;
    }
    const matchGender = !genderFilter || (() => {
      const g = p.gender ?? 'both';
      return g === genderFilter || g === 'both';
    })();
    return matchCat && matchSearch && matchAge && matchGender;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 max-w-md mx-auto">
        <div className="relative">
          <input type="text" placeholder={t('shop.search.ph')} value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full border-2 border-gray-200 focus:border-[#F5C518] rounded-xl px-4 py-3 pr-10 outline-none ${isRtl ? 'text-right' : 'text-left'}`} />
          <svg className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {displayCategories.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-full border-2 font-semibold text-sm transition ${
              activeCategory === cat.id ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 hover:border-gray-900 text-gray-700'
            }`}>
            {t(`cat.${cat.id}` as Parameters<typeof t>[0]) || cat.name}
            <span className={`text-xs font-bold px-1.5 rounded-full ${activeCategory === cat.id ? 'bg-white text-gray-900' : 'bg-gray-100'}`}>
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Age group filter */}
      <div className="flex flex-wrap gap-2 justify-center mb-3">
        {AGE_GROUPS.map(ag => (
          <button key={ag.id} onClick={() => setAgeFilter(ag.id)}
            title={ag.desc}
            className={`flex flex-col items-center px-4 py-2 rounded-2xl border-2 font-semibold text-xs transition ${
              ageFilter === ag.id
                ? 'bg-amber-400 border-amber-400 text-gray-900'
                : 'border-gray-200 hover:border-amber-400 text-gray-600'
            }`}>
            <span className="font-bold text-sm">{ag.id === '' ? '🎯 ' : ''}{ag.label}</span>
            {'name' in ag && ag.name && <span className="text-[10px] opacity-80 mt-0.5">{ag.name}</span>}
          </button>
        ))}
      </div>

      {/* Gender filter */}
      <div className="flex gap-2 justify-center mb-8">
        {[
          { id: '' as const,      icon: '👥', label: isRtl ? 'الكل' : 'All' },
          { id: 'male' as const,  icon: '👦', label: isRtl ? 'ذكور' : 'Boys' },
          { id: 'female' as const, icon: '👧', label: isRtl ? 'إناث' : 'Girls' },
        ].map(g => (
          <button key={g.id} onClick={() => setGenderFilter(g.id)}
            className={`flex items-center gap-1.5 px-5 py-1.5 rounded-full border-2 font-semibold text-xs transition ${
              genderFilter === g.id
                ? 'bg-sky-500 border-sky-500 text-white'
                : 'border-gray-200 hover:border-sky-400 text-gray-600'
            }`}>
            {g.icon} {g.label}
          </button>
        ))}
      </div>

      {showChildBanner && (
        <div className="bg-gradient-to-l from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👨‍👩‍👧‍👦</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">{isRtl ? 'أضف أطفالك واحصل على 50 نقطة مجانًا' : 'Add your children & earn 50 free points'}</p>
              <p className="text-xs text-gray-500">{isRtl ? 'نرشح لك منتجات مناسبة لعمر كل طفل' : "We'll suggest age-appropriate products for each child"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/account?tab=children" className="bg-[#F5C518] hover:bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-xl text-xs transition whitespace-nowrap">
              {isRtl ? 'أضف الآن' : 'Add Now'}
            </Link>
            <button onClick={() => setShowChildBanner(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>
        </div>
      )}

      <p className="text-gray-500 text-sm mb-6">{filtered.length} {t('shop.results')}</p>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {expandProducts(filtered).map(item => (
            <ProductCard key={item.key} product={item.product} modelIndex={item.modelIndex} priceLoading={priceLoading} />
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

export default function ShopPageClient({ initialProducts }: { initialProducts?: Product[] }) {
  const { t, lang } = useLang();
  const isRtl = lang === 'ar';

  return (
    <>
      <section className="relative w-full h-screen overflow-hidden">
        <HeroSlideshow />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/75" style={{ zIndex: 2 }} />
        <div className="absolute inset-x-0 bottom-24 flex flex-col items-center text-center px-6"
          style={{ zIndex: 3 }} dir={isRtl ? 'rtl' : 'ltr'}>
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white drop-shadow-lg leading-tight">
            {t('home.hero.title')}
          </h1>
          <p className="text-white/80 mt-3 text-base sm:text-lg md:text-xl max-w-xl drop-shadow">
            {t('home.hero.subtitle')}
          </p>
          <Link href="/library"
            className="mt-6 inline-flex items-center gap-2 bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            {isRtl ? 'اكتشف المكتبة الرقمية' : 'Explore Digital Library'}
            <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none animate-pulse">
              {isRtl ? 'جديد' : 'NEW'}
            </span>
          </Link>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce" style={{ zIndex: 3 }}>
          <span className="text-white/60 text-xs tracking-widest uppercase">scroll</span>
          <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      <FadeInSection>
        <Suspense>
          <ShopContent ssrProducts={initialProducts} />
        </Suspense>
      </FadeInSection>
    </>
  );
}
