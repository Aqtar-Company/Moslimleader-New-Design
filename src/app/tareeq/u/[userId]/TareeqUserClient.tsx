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
}

export default function TareeqUserClient({ profileUser, initialPosts, initialCursor, likedIds: initialLiked }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<TareeqPostSummary[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [likedIds] = useState<Set<string>>(new Set(initialLiked));
  const [showCreate, setShowCreate] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loading) loadMore(cursor); },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, loading, loadMore]);

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

  const joinYear = new Date(profileUser.createdAt).getFullYear();
  const skeletons = Array.from({ length: 6 });

  return (
    <TareeqNotificationsProvider>
    <div className="min-h-screen">
      <TareeqHeader onCreateClick={handleCreateClick} />

      {/* Profile hero */}
      <div className="py-10 px-4 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div style={{ width: 280, height: 280, background: 'radial-gradient(circle, rgba(212,168,83,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        </div>
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-3 relative">
          {profileUser.avatarUrl ? (
            <img
              src={profileUser.avatarUrl}
              alt={profileUser.name}
              className="w-20 h-20 rounded-full object-cover"
              style={{ boxShadow: '0 0 0 3px var(--tr-gold-dim), 0 0 20px var(--tr-gold-glow)' }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black"
              style={{
                background: 'var(--tr-overlay)',
                color: 'var(--tr-gold)',
                boxShadow: '0 0 0 3px var(--tr-gold-dim), 0 0 20px var(--tr-gold-glow)',
                border: '1px solid var(--tr-border-soft)',
              }}
            >
              {profileUser.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-black text-2xl sm:text-3xl" style={{ color: 'var(--tr-text-primary)' }}>{profileUser.name}</h1>
            <p className="text-xs mt-1" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? `انضم ${joinYear}` : `Joined ${joinYear}`} · {posts.length}+ {isRtl ? 'علامة' : 'marks'}
            </p>
            {user && user.userId !== profileUser.id && (
              <button
                onClick={handleSendMessage}
                className="mt-3 flex items-center gap-2 font-bold text-sm px-5 py-2 rounded-full transition mx-auto active:scale-95"
                style={{
                  background: 'var(--tr-overlay)',
                  color: 'var(--tr-gold)',
                  border: '1px solid var(--tr-gold-dim)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-gold-glow)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {isRtl ? 'أرسل رسالة' : 'Send Message'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-5xl mx-auto px-4 py-8 pb-28 sm:pb-8">
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✨</div>
            <p className="font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
              {isRtl ? 'لا توجد علامات بعد' : 'No marks yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="break-inside-avoid">
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
      </div>

      {showCreate && <TareeqCreateModal onClose={() => setShowCreate(false)} onCreated={() => {}} />}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
    </TareeqNotificationsProvider>
  );
}
