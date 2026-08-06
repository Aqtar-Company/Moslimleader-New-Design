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
import TareeqBottomNav from '@/components/tareeq/TareeqBottomNav';
import TareeqPWA, { TareeqInstallBanner } from '@/components/tareeq/TareeqPWA';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';

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
  const [pullY, setPullY] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedTopRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const PULL_THRESHOLD = 72;

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

  // App shortcut: /tareeq?action=create
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'create') {
      window.history.replaceState({}, '', '/tareeq');
      if (user) setShowCreate(true); else setShowGate(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Pull to refresh
  useEffect(() => {
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
    const onMove = (e: TouchEvent) => {
      if (window.scrollY > 0 || pullRefreshing) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0) setPullY(Math.min(dy, PULL_THRESHOLD + 24));
    };
    const onEnd = async () => {
      if (pullY >= PULL_THRESHOLD && !pullRefreshing) {
        if ('vibrate' in navigator) navigator.vibrate(30);
        setPullRefreshing(true);
        await loadPosts(category, search, null, sort);
        setPullRefreshing(false);
      }
      setPullY(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [pullY, pullRefreshing, category, search, sort, loadPosts]);

  function handleCreateClick() {
    if (!user) { setShowGate(true); return; }
    setShowCreate(true);
  }

  const skeletons = Array.from({ length: 6 });

  return (
    <TareeqNotificationsProvider>
    <div className="min-h-screen">
      <TareeqPWA />
      <TareeqHeader onCreateClick={handleCreateClick} />

      {/* Hero */}
      <div className="py-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div style={{ width: 240, height: 240, background: 'radial-gradient(circle, rgba(212,168,83,0.10) 0%, transparent 70%)', filter: 'blur(48px)' }} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden mx-auto mb-5 shrink-0" style={{ boxShadow: '0 0 0 2px var(--tr-gold-dim), 0 0 32px var(--tr-gold-glow)', border: '1px solid var(--tr-border-soft)' }}>
            <img src="/tareeq-logo- Rounded.png" alt="طريق" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-black text-3xl sm:text-4xl mb-2 tracking-wide" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'طريق' : 'Tareeq'}</h1>
          <p className="text-sm sm:text-base max-w-lg mx-auto leading-loose font-medium" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl
              ? 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — اترك علامة يهتدي بها غيرك'
              : 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — Leave a mark to guide others'}
          </p>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div
        className="sticky z-40"
        style={{
          top: '4.5rem',
          background: 'rgba(246,244,240,0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--tr-border-subtle)',
        }}
      >
        {/* Row 1: categories */}
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handleCategoryChange('')}
            className="text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition shrink-0"
            style={!category
              ? { background: 'var(--tr-gold-glow)', color: 'var(--tr-gold-bright)', border: '1px solid var(--tr-gold-dim)' }
              : { background: 'var(--tr-border-subtle)', color: 'var(--tr-text-secondary)', border: '1px solid transparent' }
            }
          >
            {isRtl ? 'الكل' : 'All'}
          </button>
          {CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleCategoryChange(key)}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition shrink-0"
              style={category === key
                ? { background: 'var(--tr-gold-glow)', color: 'var(--tr-gold-bright)', border: '1px solid var(--tr-gold-dim)' }
                : { background: 'var(--tr-border-subtle)', color: 'var(--tr-text-secondary)', border: '1px solid transparent' }
              }
            >
              <span>{CATEGORY_ICONS[key]}</span>
              {isRtl ? TAREEQ_CATEGORIES[key].ar : TAREEQ_CATEGORIES[key].en}
            </button>
          ))}
        </div>

        {/* Row 2: search + sort + sidebar toggle */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={isRtl ? 'ابحث في العلامات...' : 'Search marks...'}
              className="w-full rounded-full ps-8 pe-4 py-1.5 text-xs focus:outline-none transition"
              style={{
                background: 'var(--tr-overlay)',
                border: '1px solid var(--tr-border-soft)',
                color: 'var(--tr-text-primary)',
              }}
            />
          </div>
          <select
            value={sort}
            onChange={e => handleSortChange(e.target.value as 'newest' | 'liked')}
            className="rounded-full px-3 py-1.5 text-xs focus:outline-none shrink-0 cursor-pointer"
            style={{
              background: 'var(--tr-overlay)',
              border: '1px solid var(--tr-border-soft)',
              color: 'var(--tr-text-secondary)',
            }}
          >
            <option value="newest">{isRtl ? 'الأحدث' : 'Newest'}</option>
            <option value="liked">{isRtl ? 'الأكثر إعجاباً' : 'Most Liked'}</option>
          </select>
          {/* Sidebar toggle — mobile only */}
          <button
            onClick={() => setShowSidebar(v => !v)}
            className="lg:hidden rounded-full p-1.5 transition shrink-0"
            style={{ border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-secondary)' }}
            aria-label={isRtl ? 'القائمة' : 'Menu'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Pull to Refresh indicator */}
      {pullY > 12 && (
        <div
          className="fixed sm:hidden z-50 pointer-events-none flex items-center justify-center rounded-full"
          style={{
            top: `calc(4.5rem + ${Math.min((pullY - 12) * 0.7, 48)}px)`,
            left: '50%', transform: 'translateX(-50%)',
            width: 36, height: 36,
            background: 'var(--tr-surface)',
            border: '1px solid var(--tr-border-soft)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
            opacity: Math.min(pullY / PULL_THRESHOLD, 1),
          }}
        >
          <svg
            className={`w-5 h-5 ${pullRefreshing || pullY >= PULL_THRESHOLD ? 'animate-spin' : ''}`}
            style={{ color: 'var(--tr-gold)', transform: pullRefreshing ? undefined : `rotate(${pullY * 2.5}deg)` }}
            fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>
      )}

      {/* Feed + Sidebar */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-20 sm:pb-8 flex gap-6 items-start">
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
            <div className="flex justify-center mb-4">
              {search ? (
                <svg className="w-14 h-14" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              ) : (
                <svg className="w-14 h-14" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
              )}
            </div>
            <p className="font-semibold mb-2" style={{ color: 'var(--tr-text-secondary)' }}>
              {search ? (isRtl ? 'لا نتائج للبحث' : 'No results found') : (isRtl ? 'لا توجد علامات بعد' : 'No marks yet')}
            </p>
            {!search && (
              <>
                <p className="text-sm mb-6" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'كن أول من يترك علامة' : 'Be the first to leave a mark'}</p>
                <button
                  onClick={handleCreateClick}
                  className="font-black px-8 py-3 rounded-xl text-sm"
                  style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#0a0d06' }}
                >
                  {isRtl ? '★ اترك علامتك' : '★ Leave Your Mark'}
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
                  className="break-inside-avoid transition-all duration-700"
                  style={newPostId === post.id ? { outline: '2px solid var(--tr-gold)', borderRadius: 16, boxShadow: '0 0 24px var(--tr-gold-glow)' } : undefined}
                >
                  <TareeqCard post={post} initialLiked={likedIds.has(post.id)} />
                </div>
              ))}
            </div>

            {cursor && <div ref={sentinelRef} className="h-4 mt-8" />}

            {loading && (
              <div className="flex justify-center mt-8">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
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
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: 'rgba(7,13,20,0.6)' }}
            onClick={() => setShowSidebar(false)}
          />
          <div
            className="fixed inset-y-0 end-0 w-72 max-w-[90vw] z-50 lg:hidden overflow-y-auto p-4"
            style={{ background: 'var(--tr-surface)', boxShadow: '-8px 0 40px rgba(0,0,0,0.5)' }}
          >
            <button
              onClick={() => setShowSidebar(false)}
              className="mb-4 transition"
              style={{ color: 'var(--tr-text-muted)' }}
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

      {/* Bottom navigation — mobile only */}
      <TareeqBottomNav onCreateClick={handleCreateClick} />

      <TareeqInstallBanner />
      {showCreate && <TareeqCreateModal onClose={() => setShowCreate(false)} onCreated={(id?: string) => {
        loadPosts(category, search, null, sort);
        if (id) { setNewPostId(id); setTimeout(() => setNewPostId(null), 3000); }
        setTimeout(() => feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      }} />}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
    </TareeqNotificationsProvider>
  );
}
