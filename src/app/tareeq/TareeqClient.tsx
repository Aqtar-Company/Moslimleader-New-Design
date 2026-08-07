'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCardSkeleton from '@/components/tareeq/TareeqCardSkeleton';
import TareeqCreateModal from '@/components/tareeq/TareeqCreateModal';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS, CATEGORY_ACCENT_HEX } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import TareeqSidebar from '@/components/tareeq/TareeqSidebar';
import TareeqPWA, { TareeqInstallBanner } from '@/components/tareeq/TareeqPWA';
import { consumeCameraFile } from '@/lib/tareeq-camera-store';

const CATEGORY_KEYS = Object.keys(TAREEQ_CATEGORIES) as TareeqCategoryKey[];

/** Modern SVG icon per category — replaces emoji */
function CategoryIcon({ catKey, color }: { catKey: string; color: string }) {
  const props = { className: 'w-6 h-6', fill: 'none', stroke: color, strokeWidth: 1.7, viewBox: '0 0 24 24' } as const;
  switch (catKey) {
    case 'experience': return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    );
    case 'story': return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    );
    case 'idea': return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    );
    case 'question': return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    );
    case 'project': return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    );
    case 'reflection': return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
    default: return <span className="text-lg">{catKey}</span>;
  }
}

interface Props { initialPosts: TareeqPostSummary[]; initialCursor: string | null; }

export default function TareeqClient({ initialPosts, initialCursor }: Props) {
  const { isRtl } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const [posts, setPosts] = useState<TareeqPostSummary[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [sort, setSort] = useState<'newest' | 'liked' | 'following'>('newest');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [sharePrefill, setSharePrefill] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [reactedPosts, setReactedPosts] = useState<Record<string, string>>({});
  const [newPostId, setNewPostId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedTopRef = useRef<HTMLDivElement>(null);
  const searchMountedRef = useRef(false);
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const touchStartY = useRef(0);
  // Refs so touch handlers don't form stale closures
  const pullYRef = useRef(0);
  const pullRefreshingRef = useRef(false);
  const categoryRef = useRef(category);
  const searchValRef = useRef(search);
  const sortRef = useRef(sort);
  const PULL_THRESHOLD = 72;

  useEffect(() => {
    if (!user) { setLikedIds(new Set()); setReactedPosts({}); return; }
    fetch('/api/tareeq/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setLikedIds(new Set(d.likedIds ?? []));
        setReactedPosts(d.reactedPosts ?? {});
      })
      .catch(() => {});
  }, [user]);

  const loadPosts = useCallback(async (cat: string, q: string, fromCursor?: string | null, sortBy: 'newest' | 'liked' | 'following' = 'newest') => {
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

  // Debounced search — skip the initial mount to avoid overwriting SSR data
  useEffect(() => {
    if (!searchMountedRef.current) { searchMountedRef.current = true; return; }
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
    // Switching to a category clears the "following" feed
    const effectiveSort = sort === 'following' ? 'newest' : sort;
    if (sort === 'following') setSort('newest');
    loadPosts(key, search, null, effectiveSort);
  }

  function handleSortChange(newSort: 'newest' | 'liked' | 'following') {
    setSort(newSort);
    loadPosts(category, search, null, newSort);
  }

  function handleFollowingCircleClick() {
    if (!user) { setShowGate(true); return; }
    if (sort === 'following') {
      handleSortChange('newest');
    } else {
      handleSortChange('following');
    }
  }

  // Keep filter refs in sync so pull-to-refresh onEnd always has fresh values
  useEffect(() => { categoryRef.current = category; }, [category]);
  useEffect(() => { searchValRef.current = search; }, [search]);
  useEffect(() => { sortRef.current = sort; }, [sort]);

  // App shortcut / Share Target: /tareeq?action=create — wait for auth to settle
  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'create') {
      window.history.replaceState({}, '', '/tareeq');
      try {
        const prefill = sessionStorage.getItem('tareeq-share-prefill') ?? '';
        sessionStorage.removeItem('tareeq-share-prefill');
        if (prefill) setSharePrefill(prefill);
      } catch { /* private mode */ }
      if (user) setShowCreate(true); else setShowGate(true);
    }
  }, [authLoading, user]);

  // Share prefill recovery: if user just logged in while sharePrefill is pending, open the modal
  useEffect(() => {
    if (authLoading || !user || !sharePrefill || showCreate) return;
    setShowCreate(true);
  }, [authLoading, user, sharePrefill, showCreate]);

  // Pull to refresh — registered once; refs keep state fresh without listener churn
  useEffect(() => {
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
    const onMove = (e: TouchEvent) => {
      if (window.scrollY > 0 || pullRefreshingRef.current) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0) {
        const clamped = Math.min(dy, PULL_THRESHOLD + 24);
        pullYRef.current = clamped;
        setPullY(clamped);
      }
    };
    const onEnd = async () => {
      const snap = pullYRef.current;
      if (snap >= PULL_THRESHOLD && !pullRefreshingRef.current) {
        if ('vibrate' in navigator) navigator.vibrate(30);
        pullRefreshingRef.current = true;
        setPullRefreshing(true);
        await loadPosts(categoryRef.current, searchValRef.current, null, sortRef.current);
        pullRefreshingRef.current = false;
        setPullRefreshing(false);
      }
      pullYRef.current = 0;
      setPullY(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [loadPosts]);

  function handleCreateClick() {
    if (!user) { setShowGate(true); return; }
    setShowCreate(true);
  }

  // Bottom nav star button — open create modal directly when already on /tareeq
  useEffect(() => {
    const h = () => {
      if (!user) { setShowGate(true); return; }
      setShowCreate(true);
    };
    window.addEventListener('tareeq-open-create', h);
    return () => window.removeEventListener('tareeq-open-create', h);
  }, [user]);

  // Home nav tap while already on /tareeq — reset all filters
  useEffect(() => {
    const h = () => {
      setCategory('');
      setSort('newest');
      loadPosts('', search, null, 'newest');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('tareeq-reset-filters', h);
    return () => window.removeEventListener('tareeq-reset-filters', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, loadPosts]);

  // Camera file ready — reads from module store (avoids CustomEvent.detail issues on mobile)
  useEffect(() => {
    function openCameraModal() {
      const file = consumeCameraFile();
      if (!file) return;
      if (!user) { setShowGate(true); return; }
      setCameraFile(file);
      setShowCreate(true);
    }
    // Handle event fired while already on /tareeq
    window.addEventListener('tareeq-camera-ready', openCameraModal);
    // Handle case where we navigated to /tareeq from another page — file may already be in store
    openCameraModal();
    return () => window.removeEventListener('tareeq-camera-ready', openCameraModal);
  }, [user]);

  const skeletons = Array.from({ length: 6 });

  return (
    <div className="min-h-screen">
      <TareeqPWA />

      <TareeqHeader
        onCreateClick={handleCreateClick}
        searchInput={searchInput}
        onSearch={v => setSearchInput(v)}
        onToggleSidebar={() => setShowSidebar(prev => !prev)}
      />

      {/* ── Discover title + sort ──────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-2 flex items-center justify-between gap-3">
        <h1 className="font-black text-2xl" style={{ color: 'var(--tr-text-primary)' }}>
          {isRtl ? 'اكتشف' : 'Discover'}
        </h1>
        <div className="flex items-center gap-1.5 shrink-0">
          {(['newest', 'liked', ...(user ? ['following'] : [])] as ('newest' | 'liked' | 'following')[]).map(s => {
            const labels: Record<string, string> = { newest: isRtl ? 'جديد' : 'New', liked: isRtl ? 'الأفضل' : 'Top', following: isRtl ? 'أتابع' : 'Feed' };
            const active = sort === s;
            return (
              <button
                key={s}
                onClick={() => handleSortChange(s)}
                className="text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                style={active
                  ? { background: 'var(--tr-gold)', color: '#fff', boxShadow: '0 2px 8px var(--tr-gold-glow)' }
                  : { background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }
                }
              >
                {labels[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Story circles — categories ──────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 pb-5 flex gap-4 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Add / Create circle */}
        <button
          onClick={handleCreateClick}
          className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
          aria-label={isRtl ? 'إضافة علامة' : 'Add mark'}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'var(--tr-raised)', border: '2px dashed var(--tr-border-strong)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-secondary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <span className="text-[10px] font-semibold w-14 text-center truncate" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl ? 'إضافة' : 'Add'}
          </span>
        </button>

        {/* Following — only when logged in */}
        {user && (
          <button
            onClick={handleFollowingCircleClick}
            className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
              style={{
                background: sort === 'following' ? 'var(--tr-gold-glow)' : 'var(--tr-surface)',
                border: `2px solid ${sort === 'following' ? 'var(--tr-gold)' : 'var(--tr-border-soft)'}`,
                boxShadow: sort === 'following' ? '0 0 0 3px var(--tr-gold-glow)' : 'none',
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke={sort === 'following' ? 'var(--tr-gold)' : 'var(--tr-text-muted)'} strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-semibold w-14 text-center truncate" style={{ color: sort === 'following' ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
              {isRtl ? 'متابَعون' : 'Following'}
            </span>
          </button>
        )}

        {/* All — active only when no category selected AND not in following mode */}
        <button
          onClick={() => { setSort(s => s === 'following' ? 'newest' : s); handleCategoryChange(''); }}
          className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
        >
          {(() => {
            const allActive = !category && sort !== 'following';
            return (
              <>
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: allActive ? 'var(--tr-gold-glow)' : 'var(--tr-surface)',
                    border: `2px solid ${allActive ? 'var(--tr-gold)' : 'var(--tr-border-soft)'}`,
                    boxShadow: allActive ? '0 0 0 3px var(--tr-gold-glow)' : 'none',
                  }}
                >
                  <svg className="w-6 h-6" fill="none" stroke={allActive ? 'var(--tr-gold)' : 'var(--tr-text-muted)'} strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <span className="text-[10px] font-semibold w-14 text-center truncate" style={{ color: allActive ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
                  {isRtl ? 'الكل' : 'All'}
                </span>
              </>
            );
          })()}
        </button>

        {/* Category circles */}
        {CATEGORY_KEYS.map((key) => {
          const accent = CATEGORY_ACCENT_HEX[key] ?? 'var(--tr-gold)';
          const active = category === key;
          return (
            <button
              key={key}
              onClick={() => handleCategoryChange(active ? '' : key)}
              className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: active ? `${accent}22` : 'var(--tr-surface)',
                  border: `2px solid ${active ? accent : 'var(--tr-border-soft)'}`,
                  boxShadow: active ? `0 0 0 3px ${accent}22` : 'none',
                }}
              >
                <CategoryIcon catKey={key} color={active ? accent : 'var(--tr-text-muted)'} />
              </div>
              <span className="text-[10px] font-semibold w-14 text-center truncate" style={{ color: active ? accent : 'var(--tr-text-muted)' }}>
                {isRtl ? TAREEQ_CATEGORIES[key].ar : TAREEQ_CATEGORIES[key].en}
              </span>
            </button>
          );
        })}
      </div>


      {/* Pull to Refresh indicator */}
      {pullY > 12 && (
        <div
          className="fixed sm:hidden z-50 pointer-events-none flex items-center justify-center rounded-full"
          style={{
            top: `calc(56px + ${Math.min((pullY - 12) * 0.7, 48)}px)`,
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
      <div className="max-w-2xl mx-auto px-4 py-6 sm:pb-8 flex gap-6 items-start">
        <div ref={feedTopRef} className="flex-1 min-w-0">
        {initialLoading ? (
          <div className="flex flex-col gap-4">
            {skeletons.map((_, i) => (
              <div key={i}>
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
                  style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#fff' }}
                >
                  {isRtl ? '★ اترك علامتك' : '★ Leave Your Mark'}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="transition-all duration-700"
                  style={newPostId === post.id ? { outline: '2px solid var(--tr-gold)', borderRadius: 16, boxShadow: '0 0 24px var(--tr-gold-glow)' } : undefined}
                >
                  <TareeqCard post={post} initialLiked={likedIds.has(post.id)} initialReaction={reactedPosts[post.id] ?? null} />
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
            style={{ background: 'var(--tr-surface)', boxShadow: isRtl ? '8px 0 40px rgba(0,0,0,0.5)' : '-8px 0 40px rgba(0,0,0,0.5)' }}
          >
            <button
              onClick={() => setShowSidebar(false)}
              className="mb-4 transition"
              style={{ color: 'var(--tr-text-muted)' }}
              aria-label={isRtl ? 'إغلاق' : 'Close'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <TareeqSidebar onCreateClick={() => { setShowSidebar(false); handleCreateClick(); }} />
          </div>
        </>
      )}

      <TareeqInstallBanner />
      {showCreate && <TareeqCreateModal
        initialContent={sharePrefill}
        initialFile={cameraFile ?? undefined}
        onClose={() => { setShowCreate(false); setSharePrefill(''); setCameraFile(null); }}
        onCreated={(id?: string) => {
          setSharePrefill('');
          loadPosts(category, search, null, sort);
          if (id) { setNewPostId(id); setTimeout(() => setNewPostId(null), 3000); }
          setTimeout(() => feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
        }}
      />}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
  );
}
