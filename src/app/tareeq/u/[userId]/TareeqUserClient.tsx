'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCardSkeleton from '@/components/tareeq/TareeqCardSkeleton';
import TareeqCreateModal from '@/components/tareeq/TareeqCreateModal';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import TareeqHeader from '@/components/tareeq/TareeqHeader';

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

  const joinYear = new Date(profileUser.createdAt).getFullYear();
  const skeletons = Array.from({ length: 6 });

  return (
    <div className="min-h-screen bg-gray-50">
      <TareeqHeader onCreateClick={handleCreateClick} />
      <div className="pt-11" />

      {/* Profile hero */}
      <div className="bg-[#0a1f1a] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-3">
          {profileUser.avatarUrl ? (
            <img src={profileUser.avatarUrl} alt={profileUser.name} className="w-20 h-20 rounded-full object-cover ring-4 ring-emerald-700/60" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-emerald-800 text-white flex items-center justify-center text-3xl font-black ring-4 ring-emerald-700/60">
              {profileUser.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-black text-2xl sm:text-3xl">{profileUser.name}</h1>
            <p className="text-emerald-400/70 text-xs mt-1">
              {isRtl ? `انضم ${joinYear}` : `Joined ${joinYear}`} · {posts.length}+ {isRtl ? 'علامة' : 'marks'}
            </p>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-5xl mx-auto px-4 py-8 pb-28 sm:pb-8">
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✨</div>
            <p className="text-gray-500 font-semibold">
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
                <div className="w-6 h-6 border-2 border-gray-300 border-t-[#1a1a2e] rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && <TareeqCreateModal onClose={() => setShowCreate(false)} onCreated={() => {}} />}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
  );
}
