'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCreateModal from '@/components/tareeq/TareeqCreateModal';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';

const CATEGORIES_AR = ['الكل', 'تجربة', 'قصة', 'فكرة', 'سؤال', 'مشروع', 'تأمل'];
const CATEGORIES_EN = ['All', 'Experience', 'Story', 'Idea', 'Question', 'Project', 'Reflection'];

interface Props { initialPosts: TareeqPostSummary[]; initialCursor: string | null; }

export default function TareeqClient({ initialPosts, initialCursor }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const [posts, setPosts] = useState<TareeqPostSummary[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showGate, setShowGate] = useState(false);

  const categories = isRtl ? CATEGORIES_AR : CATEGORIES_EN;

  const loadPosts = useCallback(async (cat: string, fromCursor?: string | null) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '12' });
    const mappedCat = isRtl ? cat : cat.toLowerCase();
    if (mappedCat && mappedCat !== 'الكل' && mappedCat !== 'all') params.set('category', cat);
    if (fromCursor) params.set('cursor', fromCursor);
    const res = await fetch(`/api/tareeq?${params}`);
    if (res.ok) {
      const data = await res.json();
      setPosts(prev => fromCursor ? [...prev, ...data.posts] : data.posts);
      setCursor(data.nextCursor);
    }
    setLoading(false);
  }, [isRtl]);

  function handleCategoryChange(cat: string) {
    const val = (cat === 'الكل' || cat === 'All') ? '' : cat;
    setCategory(val);
    loadPosts(val, null);
  }

  function handleCreateClick() {
    if (!user) { setShowGate(true); return; }
    setShowCreate(true);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#1a1a2e] text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-5xl mb-3">⭐</div>
          <h1 className="font-black text-3xl sm:text-4xl mb-2">{isRtl ? 'طريق' : 'Tareeq'}</h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
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
            {categories.map((cat) => {
              const isActive = (cat === 'الكل' || cat === 'All') ? !category : category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition shrink-0 ${
                    isActive
                      ? 'bg-[#1a1a2e] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <button
            onClick={handleCreateClick}
            className="shrink-0 bg-amber-400 hover:bg-amber-500 text-gray-900 font-black text-xs px-4 py-2 rounded-full transition flex items-center gap-1.5"
          >
            <span className="text-base leading-none">⭐</span>
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
            <button
              onClick={handleCreateClick}
              className="bg-[#1a1a2e] text-[#F5C518] font-black px-8 py-3 rounded-xl text-sm"
            >
              {isRtl ? '⭐ اترك علامتك' : '⭐ Leave Your Mark'}
            </button>
          </div>
        ) : (
          <>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="break-inside-avoid">
                  <TareeqCard post={post} />
                </div>
              ))}
            </div>

            {/* Load more */}
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
        className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:hidden z-30 bg-[#1a1a2e] text-[#F5C518] font-black px-8 py-3.5 rounded-full shadow-lg text-sm flex items-center gap-2"
      >
        ⭐ {isRtl ? 'اترك علامة' : 'Leave a Mark'}
      </button>

      {showCreate && <TareeqCreateModal onClose={() => setShowCreate(false)} onCreated={() => loadPosts(category, null)} />}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
  );
}
