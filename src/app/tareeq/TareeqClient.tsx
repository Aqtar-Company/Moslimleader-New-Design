'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCardSkeleton from '@/components/tareeq/TareeqCardSkeleton';
import TareeqCreateModal from '@/components/tareeq/TareeqCreateModal';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import TareeqSidebar from '@/components/tareeq/TareeqSidebar';
import TareeqPWA, { TareeqInstallBanner } from '@/components/tareeq/TareeqPWA';

const CATEGORY_KEYS = Object.keys(TAREEQ_CATEGORIES) as TareeqCategoryKey[];

interface Props { initialPosts: TareeqPostSummary[]; initialCursor: string | null; }

export default function TareeqClient({ initialPosts, initialCursor }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const [posts, setPosts] = useState<TareeqPostSummary[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [sort, setSort] = useState<'newest' | 'liked'>('newest');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [newPostId, setNewPostId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { setLikedIds(new Set()); return; }
    fetch('/api/tareeq/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setLikedIds(new Set(d.likedIds ?? [])))
      .catch(() => {});
  }, [user]);

  const loadPosts = useCallback(async (cat: string, q: string, fromCursor?: string | null, sortBy: 'newest' | 'liked' = 'newest') => {
    if (fromCursor) { setLoading(true); } else { setInitialLoading(true); }
    try {
      const params = new URLSearchParams({ limit: '12' });
      if (cat) params.set('category', cat);
      if (q) params.set('search', q);
      if (fromCursor) params.set('cursor', fromCursor);
      if (sortBy !== 'newest') params.set('sort', sortBy);
      const res = await fetch(`/api/tareeq?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => fromCursor ? [...prev, ...data.posts] : data.posts);
        setCursor(data.nextCursor);
      }
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loading) loadPosts(category, search, cursor, sort); },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, loading, category, search, sort, loadPosts]);

  // Debounced search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearch(searchInput);
      loadPosts(category, searchInput, null, sort);
    }, 400);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function handleCategoryChange(key: string) {
    setCategory(key);
    loadPosts(key, search, null, sort);
  }

  function handleSortChange(newSort: 'newest' | 'liked') {
    setSort(newSort);
    loadPosts(category, search, null, newSort);
  }

  function handleCreateClick() {
    if (!user) { setShowGate(true); return; }
    setShowCreate(true);
  }

  const skeletons = Array.from({ length: 6 });

  return (
    <div className="min-h-screen bg-gray-50">
      <TareeqPWA />
      <TareeqHeader onCreateClick={handleCreateClick} />

      <div className="pt-11" />

      {/* Hero */}
      <div className="bg-[#0a1f1a] text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl overflow-hidden mx-auto mb-4 block drop-shadow-[0_0_20px_rgba(0,200,120,0.4)]">
            <img src="/tareeq-logo- Rounded.png" alt="طريق" className="w-full h-full object-cover" />
          </span>
          <h1 className="font-black text-3xl sm:text-4xl mb-2 tracking-wide">{isRtl ? 'طريق' : 'Tareeq'}</h1>
          <p className="text-emerald-300/70 text-sm sm:text-base max-w-lg mx-auto leading-relaxed font-medium">
            {isRtl
              ? 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — اترك علامة يهتدي بها غيرك'
              : 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — Leave a mark to guide others'}
          </p>
        </div>
      </div>

      {/* Sticky bar — 2 rows */}
      <div className="sticky top-11 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        {/* Row 1: categories */}
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handleCategoryChange('')}
            className={`text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition shrink-0 ${
              !category ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isRtl ? 'الكل' : 'All'}
          </button>
          {CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleCategoryChange(key)}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition shrink-0 ${
                category === key ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{CATEGORY_ICONS[key]}</span>
              {isRtl ? TAREEQ_CATEGORIES[key].ar : TAREEQ_CATEGORIES[key].en}
            </button>
          ))}
        </div>

        {/* Row 2: search + sort + sidebar toggle */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={isRtl ? 'ابحث في العلامات...' : 'Search marks...'}
              className="w-full border border-gray-200 rounded-full ps-8 pe-4 py-1.5 text-xs focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition bg-white"
            />
          </div>
          <select
            value={sort}
            onChange={e => handleSortChange(e.target.value as 'newest' | 'liked')}
            className="border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-purple-300 bg-white shrink-0 cursor-pointer"
          >
            <option value="newest">{isRtl ? 'الأحدث' : 'Newest'}</option>
            <option value="liked">{isRtl ? 'الأكثر إعجاباً' : 'Most Liked'}</option>
          </select>
          {/* Sidebar toggle — mobile only */}
          <button
            onClick={() => setShowSidebar(v => !v)}
            className="lg:hidden border border-gray-200 rounded-full p-1.5 text-gray-500 hover:bg-gray-50 transition shrink-0"
            aria-label={isRtl ? 'القائمة' : 'Menu'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Feed + Sidebar */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-28 sm:pb-8 flex gap-6 items-start">
        <div ref={feedTopRef} className="flex-1 min-w-0">
        {initialLoading ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {skeletons.map((_, i) => (
              <div key={i} className="break-inside-avoid">
                <TareeqCardSkeleton />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">{search ? '🔍' : '✨'}</div>
            <p className="text-gray-500 font-semibold mb-2">
              {search ? (isRtl ? 'لا نتائج للبحث' : 'No results found') : (isRtl ? 'لا توجد علامات بعد' : 'No marks yet')}
            </p>
            {!search && (
              <>
                <p className="text-gray-400 text-sm mb-6">{isRtl ? 'كن أول من يترك علامة' : 'Be the first to leave a mark'}</p>
                <button onClick={handleCreateClick} className="bg-[#1a1a2e] text-[#F5C518] font-black px-8 py-3 rounded-xl text-sm">
                  {isRtl ? '⭐ اترك علامتك' : '⭐ Leave Your Mark'}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className={`break-inside-avoid transition-all duration-700 ${newPostId === post.id ? 'ring-2 ring-emerald-400 rounded-2xl shadow-lg shadow-emerald-100' : ''}`}
                >
                  <TareeqCard post={post} initialLiked={likedIds.has(post.id)} />
                </div>
              ))}
            </div>

            {cursor && <div ref={sentinelRef} className="h-4 mt-8" />}

            {loading && (
              <div className="flex justify-center mt-8">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-[#1a1a2e] rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
        </div>{/* end feed col */}

        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-28 space-y-4">
          <TareeqSidebar onCreateClick={handleCreateClick} />
        </aside>
      </div>{/* end flex row */}

      {/* Mobile sidebar drawer */}
      {showSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setShowSidebar(false)}
          />
          <div className="fixed inset-y-0 end-0 w-72 max-w-[90vw] bg-gray-50 z-50 lg:hidden overflow-y-auto p-4 shadow-2xl">
            <button
              onClick={() => setShowSidebar(false)}
              className="mb-4 text-gray-400 hover:text-gray-600 transition"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <TareeqSidebar onCreateClick={() => { setShowSidebar(false); handleCreateClick(); }} />
          </div>
        </>
      )}

      {/* Floating button — mobile only */}
      <button
        onClick={handleCreateClick}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:hidden z-30 bg-[#0a1f1a] text-white font-black px-7 py-3.5 rounded-full shadow-xl shadow-emerald-900/40 text-sm flex items-center gap-2 border border-emerald-700/40"
      >
        <span className="w-5 h-5 rounded-sm overflow-hidden shrink-0"><img src="/tareeq-logo- small.png" alt="" className="w-full h-full object-cover" /></span>
        {isRtl ? 'اترك علامة' : 'Leave a Mark'}
      </button>

      <TareeqInstallBanner />
      {showCreate && <TareeqCreateModal onClose={() => setShowCreate(false)} onCreated={(id?: string) => {
        loadPosts(category, search, null, sort);
        if (id) { setNewPostId(id); setTimeout(() => setNewPostId(null), 3000); }
        setTimeout(() => feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      }} />}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
  );
}
