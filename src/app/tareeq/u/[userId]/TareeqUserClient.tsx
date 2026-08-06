'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCardSkeleton from '@/components/tareeq/TareeqCardSkeleton';
import TareeqCreateModal from '@/components/tareeq/TareeqCreateModal';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProfileUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
}

interface Props {
  profileUser: ProfileUser;
  initialPosts: TareeqPostSummary[];
  initialCursor: string | null;
  likedIds: string[];
  postCount?: number;
}

/** Deterministic gradient from a string — no Math.random */
function nameGradient(name: string): string {
  const palettes = [
    ['#ff7857', '#ff3d1a'],
    ['#f59e0b', '#d97706'],
    ['#0d9488', '#0f766e'],
    ['#6366f1', '#4338ca'],
    ['#ec4899', '#be185d'],
    ['#14b8a6', '#0f766e'],
  ];
  let code = 0;
  for (let i = 0; i < name.length; i++) code += name.charCodeAt(i);
  const pair = palettes[code % palettes.length];
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

type ProfileTab = 'posts' | 'liked';

export default function TareeqUserClient({ profileUser, initialPosts, initialCursor, likedIds: initialLiked, postCount }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [posts, setPosts] = useState<TareeqPostSummary[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [likedPosts, setLikedPosts] = useState<TareeqPostSummary[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [likedCursor, setLikedCursor] = useState<string | null>(null);
  const [likedLoaded, setLikedLoaded] = useState(false);
  // Lock grid vs list layout per-tab once decided — prevents reflow on infinite scroll
  const [postsHasImages, setPostsHasImages] = useState(() => initialPosts.some(p => p.imageUrl));
  const [likedHasImages, setLikedHasImages] = useState(false);
  const [likedIds] = useState<Set<string>>(new Set(initialLiked));
  const [isFollowing, setIsFollowing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const likedSentinelRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = user?.id === profileUser.id;

  const loadMore = useCallback(async (cur: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: profileUser.id, cursor: cur, limit: '12' });
      const res = await fetch(`/api/tareeq?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => [...prev, ...data.posts]);
        setCursor(data.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }, [profileUser.id]);

  const loadLiked = useCallback(async (cur?: string | null) => {
    setLikedLoading(true);
    try {
      const params = new URLSearchParams({ likedBy: profileUser.id, limit: '12' });
      if (cur) params.set('cursor', cur);
      const res = await fetch(`/api/tareeq?${params}`);
      if (res.ok) {
        const data = await res.json();
        const newPosts = cur ? [...likedPosts, ...data.posts] : data.posts;
        setLikedPosts(newPosts);
        setLikedCursor(data.nextCursor);
        if (!likedLoaded) setLikedHasImages(newPosts.some((p: TareeqPostSummary) => p.imageUrl));
        setLikedLoaded(true);
      }
    } finally {
      setLikedLoading(false);
    }
  }, [profileUser.id]);

  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loading) loadMore(cursor); },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, loading, loadMore]);

  useEffect(() => {
    if (!likedSentinelRef.current || !likedCursor) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !likedLoading) loadLiked(likedCursor); },
      { rootMargin: '200px' },
    );
    obs.observe(likedSentinelRef.current);
    return () => obs.disconnect();
  }, [likedCursor, likedLoading, loadLiked]);

  function handleTabChange(tab: ProfileTab) {
    setActiveTab(tab);
    if (tab === 'liked' && !likedLoaded && !likedLoading) {
      loadLiked();
    }
  }

  function handleCreateClick() {
    if (!user) { setShowGate(true); return; }
    setShowCreate(true);
  }

  async function handleSendMessage() {
    if (!user) { setShowGate(true); return; }
    try {
      const res = await fetch('/api/tareeq/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: profileUser.id }),
      });
      if (res.ok) {
        const d = await res.json();
        router.push(`/tareeq/inbox/${d.conversationId}`);
      }
    } catch { /* ignore */ }
  }

  const coverGradient = nameGradient(profileUser.name);
  const skeletons = Array.from({ length: 6 });
  const displayPosts = activeTab === 'posts' ? posts : likedPosts;

  return (
    <TareeqNotificationsProvider>
    <div className="min-h-screen" style={{ background: 'var(--tr-base)' }}>
      <TareeqHeader onCreateClick={handleCreateClick} />

      {/* ── Cover ──────────────────────────────────────────────── */}
      <div
        className="relative w-full"
        style={{ height: 110, background: coverGradient }}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.12)' }} />
      </div>

      {/* ── Profile card ───────────────────────────────────────── */}
      <div
        className="max-w-2xl mx-auto px-4"
        style={{ marginTop: -32 }}
      >
        <div
          className="rounded-3xl px-5 pt-3 pb-6"
          style={{ background: 'var(--tr-surface)', boxShadow: '0 4px 32px rgba(0,0,0,0.08)', border: '1px solid var(--tr-border-subtle)' }}
        >
          {/* Avatar row */}
          <div className="flex items-start justify-between" style={{ marginTop: -44 }}>
            {/* Avatar */}
            {profileUser.avatarUrl ? (
              <img
                src={profileUser.avatarUrl}
                alt={profileUser.name}
                className="w-24 h-24 rounded-full object-cover"
                style={{ border: '4px solid var(--tr-surface)', boxShadow: '0 0 0 3px var(--tr-gold)' }}
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black"
                style={{
                  background: coverGradient,
                  color: '#fff',
                  border: '4px solid var(--tr-surface)',
                  boxShadow: '0 0 0 3px var(--tr-gold)',
                }}
              >
                {profileUser.name.charAt(0)}
              </div>
            )}

            {/* Action buttons (only for other users) */}
            {!isOwnProfile && (
              <div className="flex gap-2 mt-14">
                <button
                  onClick={() => {
                    if (!user) { setShowGate(true); return; }
                    setIsFollowing(v => !v);
                  }}
                  className="font-bold text-sm px-5 py-2 rounded-full transition active:scale-95"
                  style={isFollowing ? {
                    background: 'var(--tr-raised)',
                    color: 'var(--tr-text-secondary)',
                    border: '1px solid var(--tr-border-soft)',
                  } : {
                    background: 'var(--tr-gold)',
                    color: '#fff',
                    border: '1px solid var(--tr-gold)',
                  }}
                >
                  {isFollowing
                    ? (isRtl ? 'متابَع' : 'Following')
                    : (isRtl ? 'تابع' : 'Follow')}
                </button>
                <button
                  onClick={handleSendMessage}
                  className="font-bold text-sm px-5 py-2 rounded-full transition active:scale-95"
                  style={{
                    background: 'var(--tr-raised)',
                    color: 'var(--tr-text-secondary)',
                    border: '1px solid var(--tr-border-soft)',
                  }}
                >
                  {isRtl ? 'رسالة' : 'Message'}
                </button>
              </div>
            )}
          </div>

          {/* Name */}
          <h1 className="font-black text-xl mt-3" style={{ color: 'var(--tr-text-primary)' }}>
            {profileUser.name}
          </h1>

          {/* Stats row */}
          <div className="flex gap-6 mt-4">
            <StatItem count={postCount ?? posts.length} label={isRtl ? 'علامة' : 'Posts'} />
            <StatItem count={0} label={isRtl ? 'متابِع' : 'Followers'} />
            <StatItem count={0} label={isRtl ? 'متابَع' : 'Following'} />
          </div>
        </div>

        {/* ── Tab nav ─────────────────────────────────────────── */}
        <div
          className="flex mt-4 rounded-2xl overflow-hidden"
          style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
        >
          {(['posts', 'liked'] as ProfileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className="flex-1 py-3 font-bold text-sm transition"
              style={{
                color: activeTab === tab ? 'var(--tr-gold)' : 'var(--tr-text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--tr-gold)' : '2px solid transparent',
              }}
            >
              {tab === 'posts'
                ? (isRtl ? 'العلامات' : 'Posts')
                : (isRtl ? 'الإعجابات' : 'Liked')}
            </button>
          ))}
        </div>

        {/* ── Feed grid ───────────────────────────────────────── */}
        <div className="py-4 pb-28 sm:pb-8">
          {activeTab === 'liked' && likedLoading && !likedLoaded ? (
            <div className="flex flex-col gap-4">
              {skeletons.map((_, i) => <TareeqCardSkeleton key={i} />)}
            </div>
          ) : displayPosts.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-14 h-14 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
              <p className="font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
                {activeTab === 'liked'
                  ? (isRtl ? 'لا توجد إعجابات بعد' : 'No liked posts yet')
                  : (isRtl ? 'لا توجد علامات بعد' : 'No marks yet')}
              </p>
              {isOwnProfile && activeTab === 'posts' && (
                <button
                  onClick={handleCreateClick}
                  className="mt-5 font-black px-8 py-3 rounded-xl text-sm"
                  style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#fff' }}
                >
                  {isRtl ? '★ اترك علامتك' : '★ Leave Your Mark'}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Layout committed on first load per-tab — prevents reflow on infinite scroll */}
              {(activeTab === 'posts' ? postsHasImages : likedHasImages) ? (
                <div className="grid grid-cols-2 gap-3">
                  {displayPosts.map(post => (
                    post.imageUrl ? (
                      <GridImageCard key={post.id} post={post} liked={likedIds.has(post.id)} />
                    ) : (
                      <div key={post.id} className="col-span-2">
                        <TareeqCard post={post} initialLiked={likedIds.has(post.id)} />
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {displayPosts.map(post => (
                    <TareeqCard key={post.id} post={post} initialLiked={likedIds.has(post.id)} />
                  ))}
                </div>
              )}
              {activeTab === 'posts' && cursor && <div ref={sentinelRef} className="h-4 mt-8" />}
              {activeTab === 'liked' && likedCursor && <div ref={likedSentinelRef} className="h-4 mt-8" />}
              {(loading || likedLoading) && (
                <div className="flex justify-center mt-8">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCreate && <TareeqCreateModal onClose={() => setShowCreate(false)} onCreated={() => {}} />}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
    </TareeqNotificationsProvider>
  );
}

function StatItem({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-black text-lg" style={{ color: 'var(--tr-text-primary)' }}>
        {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
      </span>
      <span className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>{label}</span>
    </div>
  );
}

function GridImageCard({ post, liked }: { post: TareeqPostSummary; liked: boolean }) {
  return (
    <Link
      href={`/tareeq/${post.id}`}
      className="block relative rounded-2xl overflow-hidden"
      style={{ aspectRatio: '3/4' }}
    >
      <img
        src={post.imageUrl!}
        alt={post.title ?? ''}
        className="w-full h-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)' }}
      />
      {/* Like count */}
      <div
        className="absolute bottom-2 start-2 flex items-center gap-1 text-white"
        style={{ fontSize: 11, fontWeight: 700 }}
      >
        <svg className="w-3.5 h-3.5" fill={liked ? '#f43f5e' : 'none'} stroke={liked ? '#f43f5e' : 'white'} strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
        {post.likeCount > 0 && post.likeCount}
      </div>
    </Link>
  );
}
