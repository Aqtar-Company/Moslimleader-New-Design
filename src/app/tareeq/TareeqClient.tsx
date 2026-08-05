'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCreateModal from '@/components/tareeq/TareeqCreateModal';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import { TAREEQ_CATEGORIES, CATEGORY_KEY } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import TareeqHeader from '@/components/tareeq/TareeqHeader';

const CATEGORY_KEYS = Object.keys(TAREEQ_CATEGORIES) as TareeqCategoryKey[];

interface Props { initialPosts: TareeqPostSummary[]; initialCursor: string | null; }

export default function TareeqClient({ initialPosts, initialCursor }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const [posts, setPosts] = useState<TareeqPostSummary[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // Fetch user's liked posts once when logged in
  useEffect(() => {
    if (!user) { setLikedIds(new Set()); return; }
    fetch('/api/tareeq/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setLikedIds(new Set(d.likedIds ?? [])))
      .catch(() => {});
  }, [user]);

  const loadPosts = useCallback(async (cat: string, fromCursor?: string | null) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '12' });
    if (cat) params.set('category', cat);
    if (fromCursor) params.set('cursor', fromCursor);
    const res = await fetch(`/api/tareeq?${params}`);
    if (res.ok) {
      const data = await res.json();
      setPosts(prev => fromCursor ? [...prev, ...data.posts] : data.posts);
      setCursor(data.nextCursor);
    }
    setLoading(false);
  }, []);

  function handleCategoryChange(key: string) {
    setCategory(key);
    loadPosts(key, null);
  }

  function handleCreateClick() {
    if (!user) { setShowGate(true); return; }
    setShowCreate(true);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TareeqHeader onCreateClick={handleCreateClick} />

      {/* Hero — pt-14 to clear fixed header */}
      <div className="pt-14" />
      <div className="bg-[#0a1f1a] text-white py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <img
            src="/tareeq-logo- Rounded.png"
            alt="طريق"
            className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(0,200,120,0.4)]"
          />
          <h1 className="font-black text-3xl sm:text-4xl mb-2 tracking-wide">{isRtl ? 'طريق' : 'Tareeq'}</h1>
          <p className="text-emerald-300/70 text-sm sm:text-base max-w-lg mx-auto leading-relaxed font-medium">
            {isRtl
              ? 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — اترك علامة يهتدي بها غيرك'
              : 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — Leave a mark to guide others'}
          </p>
        </div>
      </div>

      {/* Sticky category bar + create button */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 flex-1 min-w-0">
            {/* All filter */}
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
                className={`text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition shrink-0 ${
                  category === key ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {isRtl ? TAREEQ_CATEGORIES[key].ar : TAREEQ_CATEGORIES[key].en}
              </button>
            ))}
          </div>
          <button
            onClick={handleCreateClick}
            className="shrink-0 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs px-4 py-2 rounded-full transition flex items-center gap-2"
          >
            <img src="/tareeq-logo- Rounded.png" alt="" className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{isRtl ? 'اترك علامة' : 'Leave a Mark'}</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>
      </div>

      {/* Masonry feed */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {posts.length === 0 && !loading ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✨</div>
            <p className="text-gray-500 font-semibold mb-2">{isRtl ? 'لا توجد علامات بعد' : 'No marks yet'}</p>
            <p className="text-gray-400 text-sm mb-6">{isRtl ? 'كن أول من يترك علامة' : 'Be the first to leave a mark'}</p>
            <button onClick={handleCreateClick} className="bg-[#1a1a2e] text-[#F5C518] font-black px-8 py-3 rounded-xl text-sm">
              {isRtl ? '⭐ اترك علامتك' : '⭐ Leave Your Mark'}
            </button>
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

            {cursor && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={() => loadPosts(category, cursor)}
                  disabled={loading}
                  className="bg-white border border-gray-200 text-gray-700 font-bold px-8 py-3 rounded-full text-sm hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {loading ? '...' : (isRtl ? 'تحميل المزيد' : 'Load More')}
                </button>
              </div>
            )}

            {loading && (
              <div className="flex justify-center mt-8">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-[#1a1a2e] rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating create button (mobile) */}
      <button
        onClick={handleCreateClick}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:hidden z-30 bg-[#0a1f1a] text-white font-black px-7 py-3.5 rounded-full shadow-xl shadow-emerald-900/40 text-sm flex items-center gap-2 border border-emerald-700/40"
      >
        <img src="/tareeq-logo- Rounded.png" alt="" className="w-5 h-5" />
        {isRtl ? 'اترك علامة' : 'Leave a Mark'}
      </button>

      {showCreate && <TareeqCreateModal onClose={() => setShowCreate(false)} onCreated={() => loadPosts(category, null)} />}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
  );
}
