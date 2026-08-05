'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';

interface Comment { id: string; content: string; createdAt: string; userId: string; user: { id: string; name: string } | null; }
interface Post {
  id: string; title: string | null; content: string; summary: string | null;
  category: string | null; tags: string[] | null; authorName: string;
  likeCount: number; commentCount: number; viewCount: number; createdAt: string;
  userId: string | null; user: { id: string; name: string } | null;
  comments: Comment[];
}

function timeAgo(dateStr: string, isRtl: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return isRtl ? `منذ ${d} يوم` : `${d}d ago`;
  if (h > 0) return isRtl ? `منذ ${h} ساعة` : `${h}h ago`;
  return isRtl ? `منذ ${m || 1} دقيقة` : `${m || 1}m ago`;
}

export default function TareeqPostClient({ post, userLiked = false, userBookmarked = false }: { post: Post; userLiked?: boolean; userBookmarked?: boolean }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const [liked, setLiked] = useState(userLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [bookmarked, setBookmarked] = useState(userBookmarked);
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showGate, setShowGate] = useState(false);

  async function toggleLike() {
    if (!user) { setShowGate(true); return; }
    const res = await fetch(`/api/tareeq/${post.id}/like`, { method: 'POST', credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(c => data.liked ? c + 1 : c - 1);
    }
  }

  async function toggleBookmark() {
    if (!user) { setShowGate(true); return; }
    const res = await fetch(`/api/tareeq/${post.id}/bookmark`, { method: 'POST', credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setBookmarked(data.bookmarked);
    }
  }

  async function submitComment() {
    if (!user) { setShowGate(true); return; }
    if (commentText.trim().length < 2) return;
    setSubmitting(true);
    const res = await fetch(`/api/tareeq/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content: commentText.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments(prev => [...prev, data.comment]);
      setCommentText('');
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <Link href="/tareeq" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2 transition">
            <svg className="w-4 h-4 rotate-180 rtl:rotate-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            {isRtl ? 'طريق' : 'Tareeq'}
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Post */}
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
          {/* Author */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center font-bold">
              {post.authorName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{post.authorName}</p>
              <p className="text-xs text-gray-400">{timeAgo(post.createdAt, isRtl)}</p>
            </div>
            {post.category && (
              <span className="ms-auto text-xs bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full">
                {post.category}
              </span>
            )}
          </div>

          {/* Title */}
          {post.title && (
            <h1 className="font-black text-gray-900 text-xl sm:text-2xl mb-4 leading-snug">{post.title}</h1>
          )}

          {/* Content */}
          <div className="text-gray-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
            {post.content}
          </div>

          {/* Tags */}
          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-100">
              {post.tags.map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={toggleLike}
              className={`flex items-center gap-2 text-sm font-semibold transition ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}
            >
              <svg className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {likeCount > 0 ? likeCount : (isRtl ? 'أعجبني' : 'Like')}
            </button>

            <button
              onClick={toggleBookmark}
              className={`flex items-center gap-2 text-sm font-semibold transition ${bookmarked ? 'text-purple-600' : 'text-gray-400 hover:text-purple-500'}`}
            >
              <svg className="w-5 h-5" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
              {isRtl ? (bookmarked ? 'محفوظ' : 'احتفظ بهذه العلامة') : (bookmarked ? 'Saved' : 'Save')}
            </button>

            <span className="ms-auto text-xs text-gray-400">
              {post.viewCount} {isRtl ? 'مشاهدة' : 'views'}
            </span>
          </div>
        </article>

        {/* Comments */}
        <section id="comments" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-black text-gray-900 text-base mb-5">
            💬 {isRtl ? 'التعليقات' : 'Comments'}
            {comments.length > 0 && <span className="ms-2 text-gray-400 font-normal text-sm">({comments.length})</span>}
          </h2>

          {comments.length === 0 ? (
            <p className="text-gray-400 text-sm mb-6">{isRtl ? 'لا توجد تعليقات بعد' : 'No comments yet'}</p>
          ) : (
            <div className="space-y-4 mb-6">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {c.user?.name.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700">{c.user?.name ?? (isRtl ? 'مجهول' : 'Anonymous')}</span>
                      <span className="text-[10px] text-gray-400">{timeAgo(c.createdAt, isRtl)}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment input */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {user ? user.name.charAt(0) : '?'}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                onClick={() => { if (!user) setShowGate(true); }}
              />
              <button
                onClick={submitComment}
                disabled={submitting || commentText.trim().length < 2}
                className="bg-[#1a1a2e] text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-gray-800 transition"
              >
                {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
              </button>
            </div>
          </div>
        </section>
      </div>

      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </div>
  );
}
