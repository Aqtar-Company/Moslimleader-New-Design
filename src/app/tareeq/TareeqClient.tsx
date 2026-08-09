'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCardSkeleton from '@/components/tareeq/TareeqCardSkeleton';
import TareeqCreateModal from '@/components/tareeq/TareeqCreateModal';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS, CATEGORY_ACCENT_HEX } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import TareeqSidebar from '@/components/tareeq/TareeqSidebar';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import TareeqPWA, { TareeqInstallBanner } from '@/components/tareeq/TareeqPWA';
import { consumeCameraFile } from '@/lib/tareeq-camera-store';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';

const CATEGORY_KEYS = Object.keys(TAREEQ_CATEGORIES) as TareeqCategoryKey[];

/** SVG icon per category */
function CategoryIcon({ catKey, color }: { catKey: string; color: string }) {
  const props = { className: 'w-6 h-6', fill: 'none', stroke: color, strokeWidth: 1.7, viewBox: '0 0 24 24' } as const;
  switch (catKey) {
    case 'experience': return (
      <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
    );
    case 'story': return (
      <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
    );
    case 'idea': return (
      <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
    );
    case 'question': return (
      <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
    );
    case 'project': return (
      <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>
    );
    case 'reflection': return (
      <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
    );
    default: return <span className="text-lg">{CATEGORY_ICONS[catKey as TareeqCategoryKey] ?? ''}</span>;
  }
}


interface Props { initialPosts: TareeqPostSummary[]; initialCursor: string | null; }

export default function TareeqClient({ initialPosts, initialCursor }: Props) {
  const { isRtl } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const { notifCount, messageCount } = useTareeqNotifications();
  const pathname = usePathname();
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
  const [trendingPosts, setTrendingPosts] = useState<TareeqPostSummary[]>([]);
  const touchStartY = useRef(0);
  const pullYRef = useRef(0);
  const pullRefreshingRef = useRef(false);
  const categoryRef = useRef(category);
  const searchValRef = useRef(search);
  const sortRef = useRef(sort);
  const PULL_THRESHOLD = 72;

  // Fetch top-liked posts for the desktop right sidebar trending widget
  useEffect(() => {
    fetch('/api/tareeq?sort=liked&limit=5')
      .then(r => r.json())
      .then(d => setTrendingPosts(d.posts ?? []))
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loading) loadPosts(category, search, cursor, sort); },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, loading, category, search, sort, loadPosts]);

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
    if (sort === 'following') { handleSortChange('newest'); } else { handleSortChange('following'); }
  }

  function handleResetFilters() {
    setCategory('');
    setSort('newest');
    loadPosts('', search, null, 'newest');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => { categoryRef.current = category; }, [category]);
  useEffect(() => { searchValRef.current = search; }, [search]);
  useEffect(() => { sortRef.current = sort; }, [sort]);

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

  useEffect(() => {
    if (authLoading || !user || !sharePrefill || showCreate) return;
    setShowCreate(true);
  }, [authLoading, user, sharePrefill, showCreate]);

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

  useEffect(() => {
    const h = () => { if (!user) { setShowGate(true); return; } setShowCreate(true); };
    window.addEventListener('tareeq-open-create', h);
    return () => window.removeEventListener('tareeq-open-create', h);
  }, [user]);

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

  useEffect(() => {
    function openCameraModal() {
      const file = consumeCameraFile();
      if (!file) return;
      if (!user) { setShowGate(true); return; }
      setCameraFile(file);
      setShowCreate(true);
    }
    window.addEventListener('tareeq-camera-ready', openCameraModal);
    openCameraModal();
    return () => window.removeEventListener('tareeq-camera-ready', openCameraModal);
  }, [user]);

  const skeletons = Array.from({ length: 6 });

  // ── Feed content (shared between mobile and desktop center col) ──
  const feedContent = (
    <>
      {initialLoading ? (
        <div className="flex flex-col gap-4">
          {skeletons.map((_, i) => <div key={i}><TareeqCardSkeleton /></div>)}
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
    </>
  );

  return (
    <div className="min-h-screen">
      <TareeqHeader
        onCreateClick={handleCreateClick}
        searchInput={searchInput}
        onSearch={setSearchInput}
        onToggleSidebar={() => setShowSidebar(v => !v)}
      />
      <TareeqPWA />

      {/* Pull to refresh indicator — mobile only */}
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

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          DESKTOP: 3-column layout — left nav + center feed + right sidebar (lg+)
          Nav is in TareeqHeader (Facebook-style top nav)
          MOBILE:  single column with bottom nav (handled by TareeqShell)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="lg:max-w-[1280px] lg:mx-auto lg:px-4 lg:pt-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_280px] lg:gap-5 lg:items-start">

        {/* ━━ LEFT SIDEBAR — desktop only ━━ */}
        <aside className="hidden lg:flex lg:flex-col sticky top-[72px] max-h-[calc(100vh-80px)] overflow-y-auto pb-4 gap-2" style={{ scrollbarWidth: 'none' }}>

          {/* Unified card: profile + nav + categories */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>

          {/* User profile card */}
          {user && (
            <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
              <Link href={`/tareeq/u/${user.id}`} className="flex items-center gap-3 group">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name ?? ''} className="w-10 h-10 rounded-full object-cover shrink-0" style={{ border: '2px solid var(--tr-gold-dim)' }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)' }}>
                    {user.name?.charAt(0) ?? '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate group-hover:underline" style={{ color: 'var(--tr-text-primary)' }}>{user.name}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'عرض الملف الشخصي' : 'View profile'}</p>
                </div>
              </Link>
            </div>
          )}

          {/* Quick navigation */}
          <nav className="py-1 px-2" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
            {([
              {
                href: '/tareeq',
                label: isRtl ? 'الرئيسية' : 'Home',
                badge: 0,
                icon: (
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                ),
              },
              {
                href: '/tareeq/notifications',
                label: isRtl ? 'الإشعارات' : 'Notifications',
                badge: notifCount,
                icon: (
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ),
              },
              {
                href: '/tareeq/inbox',
                label: isRtl ? 'الرسائل' : 'Messages',
                badge: messageCount,
                icon: (
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                ),
              },
              {
                href: user ? `/tareeq/u/${user.id}` : '/tareeq/profile',
                label: isRtl ? 'ملفي' : 'My Profile',
                badge: 0,
                icon: (
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
              },
            ] as { href: string; label: string; badge: number; icon: React.ReactNode }[]).map(({ href, icon, label, badge }) => {
              const active = pathname === href || (href !== '/tareeq' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{
                    background: active ? 'var(--tr-gold-glow)' : 'transparent',
                    color: active ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                    fontWeight: active ? 700 : 600,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {icon}
                  <span className="text-sm truncate flex-1">{label}</span>
                  {badge > 0 && (
                    <span className="text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center" style={{ background: '#f43f5e', color: '#fff' }}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Category shortcuts */}
          <div className="py-2 px-2">
            <p className="text-[10px] font-black mb-1 px-3" style={{ color: 'var(--tr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isRtl ? 'تصفح حسب' : 'Browse'}
            </p>
            {/* All */}
            <button
              onClick={() => handleCategoryChange('')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{
                background: !category ? 'var(--tr-gold-glow)' : 'transparent',
                color: !category ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                fontWeight: !category ? 700 : 600,
              }}
              onMouseEnter={e => { if (category) (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
              onMouseLeave={e => { if (category) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: !category ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span className="text-sm">{isRtl ? 'الكل' : 'All'}</span>
            </button>
            {/* Categories */}
            {CATEGORY_KEYS.map((key) => {
              const accent = CATEGORY_ACCENT_HEX[key] ?? 'var(--tr-gold)';
              const active = category === key;
              return (
                <button
                  key={key}
                  onClick={() => handleCategoryChange(active ? '' : key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{
                    background: active ? `${accent}18` : 'transparent',
                    color: active ? accent : 'var(--tr-text-secondary)',
                    fontWeight: active ? 700 : 600,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <CategoryIcon catKey={key} color={active ? accent : 'var(--tr-text-muted)'} />
                  <span className="text-sm">{isRtl ? TAREEQ_CATEGORIES[key].ar : TAREEQ_CATEGORIES[key].en}</span>
                </button>
              );
            })}
          </div>

          </div>{/* end unified sidebar card */}

          {/* New Mark CTA */}
          <button
            onClick={handleCreateClick}
            className="w-full flex items-center justify-center gap-2 font-black text-sm py-3 rounded-2xl transition active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))',
              color: '#fff',
              boxShadow: '0 4px 24px var(--tr-gold-glow)',
            }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {isRtl ? 'اترك علامتك' : 'Leave Your Mark'}
          </button>
        </aside>

        {/* ━━ CENTER — feed ━━ */}
        <div className="min-w-0" ref={feedTopRef}>

          {/* Sort tabs row */}
          <div className="max-w-2xl lg:max-w-none mx-auto ps-4 pe-4 lg:pe-0 pt-4 pb-2 flex items-center justify-between gap-3">
            <h1 className="font-black text-xl" style={{ color: 'var(--tr-text-primary)' }}>
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

          {/* Facebook-style create post box — desktop */}
          {user && (
            <div className="hidden lg:block max-w-2xl lg:max-w-none mx-auto px-0 pb-4">
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {/* Top: avatar + input */}
                <div className="flex items-center gap-3 p-3 pb-2">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name ?? ''} className="w-10 h-10 rounded-full object-cover shrink-0" style={{ border: '1.5px solid var(--tr-border-soft)' }} />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold-dim)' }}>
                      {user.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                  <input
                    readOnly
                    placeholder={isRtl ? 'ما الذي تريد مشاركته؟' : "What's on your mind?"}
                    className="flex-1 px-4 py-2.5 rounded-full outline-none cursor-pointer"
                    style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', fontSize: 14, border: '1px solid var(--tr-border-soft)' }}
                    onFocus={(e) => { e.target.blur(); if (user) setShowCreate(true); else setShowGate(true); }}
                  />
                </div>
                {/* Bottom: action buttons */}
                <div className="flex items-center px-3 py-2" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
                  <button onClick={handleCreateClick} className="flex flex-1 items-center justify-center gap-2 py-1.5 rounded-xl transition-colors" style={{ color: 'var(--tr-text-secondary)', fontSize: 13, fontWeight: 700 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--tr-overlay)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: '#22c55e' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    {isRtl ? 'صورة / فيديو' : 'Photo / Video'}
                  </button>
                  <div className="w-px h-5 mx-2" style={{ background: 'var(--tr-border-subtle)' }} />
                  <button onClick={handleCreateClick} className="flex flex-1 items-center justify-center gap-2 py-1.5 rounded-xl transition-colors" style={{ color: 'var(--tr-text-secondary)', fontSize: 13, fontWeight: 700 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--tr-overlay)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                    </svg>
                    {isRtl ? 'اترك علامة' : 'Leave a Mark'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Category story circles — mobile only (desktop uses left nav) */}
          <div className="lg:hidden max-w-2xl mx-auto px-4 pb-5 flex gap-4 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button onClick={handleCreateClick} className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform" aria-label={isRtl ? 'إضافة علامة' : 'Add mark'}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--tr-raised)', border: '2px dashed var(--tr-border-strong)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-secondary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold w-14 text-center truncate" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'إضافة' : 'Add'}</span>
            </button>

            {user && (
              <button onClick={handleFollowingCircleClick} className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform">
                <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all" style={{ background: sort === 'following' ? 'var(--tr-gold-glow)' : 'var(--tr-surface)', border: `2px solid ${sort === 'following' ? 'var(--tr-gold)' : 'var(--tr-border-soft)'}`, boxShadow: sort === 'following' ? '0 0 0 3px var(--tr-gold-glow)' : 'none' }}>
                  <svg className="w-6 h-6" fill="none" stroke={sort === 'following' ? 'var(--tr-gold)' : 'var(--tr-text-muted)'} strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <span className="text-[10px] font-semibold w-14 text-center truncate" style={{ color: sort === 'following' ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>{isRtl ? 'متابَعون' : 'Following'}</span>
              </button>
            )}

            <button onClick={() => { setSort(s => s === 'following' ? 'newest' : s); handleCategoryChange(''); }} className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform">
              {(() => {
                const allActive = !category && sort !== 'following';
                return (
                  <>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all" style={{ background: allActive ? 'var(--tr-gold-glow)' : 'var(--tr-surface)', border: `2px solid ${allActive ? 'var(--tr-gold)' : 'var(--tr-border-soft)'}`, boxShadow: allActive ? '0 0 0 3px var(--tr-gold-glow)' : 'none' }}>
                      <svg className="w-6 h-6" fill="none" stroke={allActive ? 'var(--tr-gold)' : 'var(--tr-text-muted)'} strokeWidth={1.7} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-semibold w-14 text-center truncate" style={{ color: allActive ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>{isRtl ? 'الكل' : 'All'}</span>
                  </>
                );
              })()}
            </button>

            {CATEGORY_KEYS.map((key) => {
              const accent = CATEGORY_ACCENT_HEX[key] ?? 'var(--tr-gold)';
              const active = category === key;
              return (
                <button key={key} onClick={() => handleCategoryChange(active ? '' : key)} className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all" style={{ background: active ? `${accent}22` : 'var(--tr-surface)', border: `2px solid ${active ? accent : 'var(--tr-border-soft)'}`, boxShadow: active ? `0 0 0 3px ${accent}22` : 'none' }}>
                    <CategoryIcon catKey={key} color={active ? accent : 'var(--tr-text-muted)'} />
                  </div>
                  <span className="text-[10px] font-semibold w-14 text-center truncate" style={{ color: active ? accent : 'var(--tr-text-muted)' }}>
                    {isRtl ? TAREEQ_CATEGORIES[key].ar : TAREEQ_CATEGORIES[key].en}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Feed */}
          <div className="max-w-2xl lg:max-w-none mx-auto px-4 py-2 pb-8">
            {feedContent}
          </div>
        </div>

        {/* ━━ RIGHT SIDEBAR — desktop only ━━ */}
        <aside className="hidden lg:flex lg:flex-col sticky top-[72px] max-h-[calc(100vh-80px)] overflow-y-auto pb-4 gap-3" style={{ scrollbarWidth: 'none' }}>

          {/* Trending posts widget */}
          {trendingPosts.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
              <p className="text-[10px] font-black mb-3" style={{ color: 'var(--tr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {isRtl ? '⭐ الأكثر تأثيرًا' : '⭐ Trending'}
              </p>
              <div className="space-y-0.5">
                {trendingPosts.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/tareeq/${p.id}`}
                    className="flex items-start gap-2.5 p-2 rounded-xl transition-colors"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <span className="text-xs font-black w-5 shrink-0 mt-0.5 text-center" style={{ color: i === 0 ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-snug line-clamp-2" style={{ color: 'var(--tr-text-primary)' }}>
                        {p.title || p.content.slice(0, 70)}
                      </p>
                      <p className="text-[10px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--tr-text-muted)' }}>
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                        {p.likeCount}
                        <span className="truncate">· {p.authorName}</span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Suggested users widget — quick discover */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
            <p className="text-[10px] font-black mb-3" style={{ color: 'var(--tr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isRtl ? 'اكتشف طريق' : 'Discover Tareeq'}
            </p>
            <div className="space-y-2">
              {([
                { label: isRtl ? 'استكشف التجارب' : 'Explore Experiences', cat: 'experience', accent: CATEGORY_ACCENT_HEX.experience },
                { label: isRtl ? 'اقرأ القصص' : 'Read Stories', cat: 'story', accent: CATEGORY_ACCENT_HEX.story },
                { label: isRtl ? 'شارك فكرة' : 'Share an Idea', cat: 'idea', accent: CATEGORY_ACCENT_HEX.idea },
                { label: isRtl ? 'تصفح الأسئلة' : 'Browse Questions', cat: 'question', accent: CATEGORY_ACCENT_HEX.question },
              ] as { label: string; cat: string; accent: string }[]).map(({ label, cat, accent }) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-start transition-colors"
                  style={{ background: 'var(--tr-overlay)', border: `1px solid ${accent}22` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accent}14`; (e.currentTarget as HTMLElement).style.borderColor = `${accent}44`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; (e.currentTarget as HTMLElement).style.borderColor = `${accent}22`; }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Existing sidebar widgets (share, notifications, store, about) */}
          <TareeqSidebar onCreateClick={handleCreateClick} />
        </aside>
      </div>

      {/* Mobile sidebar drawer */}
      {showSidebar && (
        <>
          <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(7,13,20,0.6)' }} onClick={() => setShowSidebar(false)} />
          <div
            className="fixed inset-y-0 end-0 w-72 max-w-[90vw] z-50 lg:hidden overflow-y-auto p-4"
            style={{ background: 'var(--tr-surface)', boxShadow: isRtl ? '8px 0 40px rgba(0,0,0,0.5)' : '-8px 0 40px rgba(0,0,0,0.5)' }}
          >
            <button onClick={() => setShowSidebar(false)} className="mb-4 transition" style={{ color: 'var(--tr-text-muted)' }} aria-label={isRtl ? 'إغلاق' : 'Close'}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <TareeqSidebar onCreateClick={() => { setShowSidebar(false); handleCreateClick(); }} />
          </div>
        </>
      )}

      <TareeqInstallBanner />
      {showCreate && (
        <TareeqCreateModal
          initialContent={sharePrefill}
          initialFile={cameraFile ?? undefined}
          onClose={() => { setShowCreate(false); setSharePrefill(''); setCameraFile(null); }}
          onCreated={(id?: string) => {
            setSharePrefill('');
            loadPosts(category, search, null, sort);
            if (id) { setNewPostId(id); setTimeout(() => setNewPostId(null), 3000); }
            setTimeout(() => feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
          }}
        />
      )}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
  );
}

