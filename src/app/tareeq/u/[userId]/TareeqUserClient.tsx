'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/lib/compress-image';
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
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [posts, setPosts] = useState<TareeqPostSummary[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [likedPosts, setLikedPosts] = useState<TareeqPostSummary[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [likedCursor, setLikedCursor] = useState<string | null>(null);
  const [likedLoaded, setLikedLoaded] = useState(false);
  const likedLoadedRef = useRef(false);
  // Lock grid vs list layout per-tab once decided — prevents reflow on infinite scroll
  const [postsHasImages, setPostsHasImages] = useState(() => initialPosts.some(p => p.imageUrl));
  const [likedHasImages, setLikedHasImages] = useState(false);
  const [likedIds] = useState<Set<string>>(new Set(initialLiked));
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [reactedPosts, setReactedPosts] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const likedSentinelRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = user?.id === profileUser.id;

  // Avatar upload (own profile only)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarProgress(0);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
    try {
      const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.88 });
      const form = new FormData();
      form.append('file', compressed);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/account/avatar');
        xhr.withCredentials = true;
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setAvatarProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) { updateUser({ avatarUrl: data.avatarUrl }); setAvatarPreview(null); resolve(); }
            else reject();
          } catch { reject(); }
        };
        xhr.onerror = () => reject();
        xhr.send(form);
      });
    } catch { /* keep preview */ }
    finally { setAvatarUploading(false); e.target.value = ''; }
  }

  // Load follow state + counts + viewer reactions on mount
  useEffect(() => {
    fetch(`/api/tareeq/follow/${profileUser.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setIsFollowing(d.isFollowing ?? false);
        setFollowerCount(d.followerCount ?? 0);
        setFollowingCount(d.followingCount ?? 0);
      })
      .catch(() => {});
    fetch('/api/tareeq/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.reactedPosts) setReactedPosts(d.reactedPosts); })
      .catch(() => {});
  }, [profileUser.id]);

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
        setLikedPosts(prev => cur ? [...prev, ...data.posts] : data.posts);
        setLikedCursor(data.nextCursor);
        if (!likedLoadedRef.current) {
          setLikedHasImages(data.posts.some((p: TareeqPostSummary) => p.imageUrl));
          likedLoadedRef.current = true;
          setLikedLoaded(true);
        }
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
        className="relative max-w-2xl mx-auto px-4"
        style={{ marginTop: -32, zIndex: 1 }}
      >
        <div
          className="rounded-3xl px-5 pt-3 pb-6"
          style={{ background: 'var(--tr-surface)', boxShadow: '0 4px 32px rgba(0,0,0,0.08)', border: '1px solid var(--tr-border-subtle)' }}
        >
          {/* Avatar row */}
          <div className="flex items-start justify-between" style={{ marginTop: -44 }}>
            {/* Avatar — tappable for own profile to upload */}
            <div className="relative shrink-0">
              {(avatarPreview || user?.avatarUrl || profileUser.avatarUrl) ? (
                <img
                  src={avatarPreview ?? (isOwnProfile ? (user?.avatarUrl ?? profileUser.avatarUrl ?? '') : (profileUser.avatarUrl ?? ''))}
                  alt={profileUser.name}
                  className="w-24 h-24 rounded-full object-cover"
                  style={{ border: '4px solid var(--tr-surface)', boxShadow: '0 0 0 3px var(--tr-gold)' }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black"
                  style={{ background: coverGradient, color: '#fff', border: '4px solid var(--tr-surface)', boxShadow: '0 0 0 3px var(--tr-gold)' }}
                >
                  {profileUser.name.charAt(0)}
                </div>
              )}

              {/* Upload progress overlay */}
              {avatarUploading && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
                  <svg className="w-16 h-16 -rotate-90 absolute" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" strokeWidth="5"
                      strokeDasharray={`${2 * Math.PI * 27}`}
                      strokeDashoffset={`${2 * Math.PI * 27 * (1 - avatarProgress / 100)}`}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.2s ease' }} />
                  </svg>
                  <span className="text-white font-black text-xs relative z-10">{avatarProgress}%</span>
                </div>
              )}

              {/* Camera icon overlay — own profile, not uploading */}
              {isOwnProfile && !avatarUploading && (
                <label
                  className="absolute bottom-0 end-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition active:scale-90"
                  style={{ background: 'var(--tr-gold)', border: '2px solid var(--tr-surface)' }}
                  aria-label={isRtl ? 'تغيير الصورة' : 'Change photo'}
                >
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAvatarUpload} />
                  <svg className="w-4 h-4" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                </label>
              )}
            </div>

            {/* Action buttons (only for other users) */}
            {!isOwnProfile && (
              <div className="flex gap-2 mt-14">
                <button
                  onClick={async () => {
                    if (!user) { setShowGate(true); return; }
                    if (followLoading) return;
                    setFollowLoading(true);
                    const wasFollowing = isFollowing;
                    // Optimistic update
                    setIsFollowing(!wasFollowing);
                    setFollowerCount(c => wasFollowing ? Math.max(0, c - 1) : c + 1);
                    try {
                      const res = await fetch(`/api/tareeq/follow/${profileUser.id}`, {
                        method: 'POST',
                        credentials: 'include',
                      });
                      if (res.ok) {
                        const d = await res.json();
                        setIsFollowing(d.following);
                      } else {
                        // Rollback on error
                        setIsFollowing(wasFollowing);
                        setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1));
                      }
                    } catch {
                      setIsFollowing(wasFollowing);
                      setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1));
                    } finally {
                      setFollowLoading(false);
                    }
                  }}
                  disabled={followLoading}
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
            <StatItem count={followerCount} label={isRtl ? 'متابِع' : 'Followers'} />
            <StatItem count={followingCount} label={isRtl ? 'متابَع' : 'Following'} />
          </div>
        </div>

        {/* ── Tab nav — Posts only ─────────────────────────── */}
        <div
          className="flex mt-4 rounded-2xl overflow-hidden"
          style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
        >
          <button
            className="flex-1 py-3 font-bold text-sm"
            style={{ color: 'var(--tr-gold)', borderBottom: '2px solid var(--tr-gold)' }}
          >
            {isRtl ? 'العلامات' : 'Posts'}
          </button>
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
                        <TareeqCard post={post} initialLiked={likedIds.has(post.id)} initialReaction={reactedPosts[post.id] ?? null} />
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
