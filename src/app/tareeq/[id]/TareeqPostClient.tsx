'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import { TAREEQ_CATEGORIES, CATEGORY_COLORS } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';

interface Comment { id: string; content: string; createdAt: string; userId: string; user: { id: string; name: string } | null; }
interface Post {
  id: string; title: string | null; content: string; summary: string | null;
  category: string | null; tags: string[] | null; imageUrl: string | null; videoUrl: string | null;
  authorName: string;
  likeCount: number; commentCount: number; viewCount: number; createdAt: string;
  userId: string | null; user: { id: string; name: string; avatarUrl?: string | null } | null;
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
  const router = useRouter();

  const [liked, setLiked] = useState(userLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [bookmarked, setBookmarked] = useState(userBookmarked);
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title ?? '');
  const [editContent, setEditContent] = useState(post.content);
  const [editSaving, setEditSaving] = useState(false);

  const isOwner = user && post.userId && user.id === post.userId;
  const catKey = post.category as TareeqCategoryKey | null;
  const catLabel = catKey && TAREEQ_CATEGORIES[catKey]
    ? (isRtl ? TAREEQ_CATEGORIES[catKey].ar : TAREEQ_CATEGORIES[catKey].en)
    : post.category;
  const categoryColor = catKey ? (CATEGORY_COLORS[catKey] ?? 'bg-amber-100 text-amber-700') : 'bg-amber-100 text-amber-700';

  // Optimistic like
  function toggleLike() {
    if (!user) { setShowGate(true); return; }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    fetch(`/api/tareeq/${post.id}/like`, { method: 'POST', credentials: 'include' })
      .then(r => { if (!r.ok) { setLiked(wasLiked); setLikeCount(c => wasLiked ? c + 1 : c - 1); } })
      .catch(() => { setLiked(wasLiked); setLikeCount(c => wasLiked ? c + 1 : c - 1); });
  }

  // Optimistic bookmark
  function toggleBookmark() {
    if (!user) { setShowGate(true); return; }
    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);
    fetch(`/api/tareeq/${post.id}/bookmark`, { method: 'POST', credentials: 'include' })
      .then(r => { if (!r.ok) setBookmarked(wasBookmarked); })
      .catch(() => setBookmarked(wasBookmarked));
  }

  async function handleShare() {
    const url = window.location.href;
    const text = post.title || post.content.slice(0, 80);
    if (navigator.share) {
      await navigator.share({ title: text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function saveEdit() {
    if (editContent.trim().length < 10) return;
    setEditSaving(true);
    const res = await fetch(`/api/tareeq/${post.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content: editContent.trim(), title: editTitle.trim() || null }),
    });
    setEditSaving(false);
    if (res.ok) { setEditing(false); router.refresh(); }
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
      <TareeqHeader onCreateClick={() => { if (!user) setShowGate(true); }} />
      <div className="pt-14" />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
          {/* Author row */}
          <div className="flex items-center gap-3 mb-6">
            {post.user?.avatarUrl ? (
              <img src={post.user.avatarUrl} alt={post.authorName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center font-bold">
                {post.authorName.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-800 text-sm">{post.authorName}</p>
              <p className="text-xs text-gray-400">{timeAgo(post.createdAt, isRtl)}</p>
            </div>
            <div className="ms-auto flex items-center gap-2">
              {catLabel && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${categoryColor}`}>
                  {catLabel}
                </span>
              )}
              {isOwner && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-gray-400 hover:text-gray-700 transition px-2 py-1 rounded-lg hover:bg-gray-100"
                >
                  ✏️ {isRtl ? 'تعديل' : 'Edit'}
                </button>
              )}
            </div>
          </div>

          {/* Edit mode */}
          {editing ? (
            <div className="space-y-3">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder={isRtl ? 'عنوان (اختياري)' : 'Title (optional)'}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={8}
                maxLength={5000}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 leading-relaxed"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={editSaving || editContent.trim().length < 10}
                  className="bg-[#1a1a2e] text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-gray-800 transition"
                >
                  {editSaving ? '...' : (isRtl ? 'حفظ' : 'Save')}
                </button>
                <button onClick={() => setEditing(false)} className="px-5 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition">
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {post.title && (
                <h1 className="font-black text-gray-900 text-xl sm:text-2xl mb-4 leading-snug">{post.title}</h1>
              )}
              <div className="text-gray-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                {post.content}
              </div>
            </>
          )}

          {/* Media */}
          {!editing && post.imageUrl && (
            <div className="mt-6 rounded-2xl overflow-hidden">
              <img src={post.imageUrl} alt="" className="w-full object-contain max-h-[60vw] sm:max-h-[500px]" />
            </div>
          )}
          {!editing && post.videoUrl && (
            <div className="mt-6 rounded-2xl overflow-hidden bg-black">
              <video src={post.videoUrl} controls playsInline className="w-full max-h-[60vw] sm:max-h-[500px]" />
            </div>
          )}

          {/* Tags */}
          {!editing && Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-100">
              {post.tags.map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          {!editing && (
            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100 flex-wrap">
              {/* Like */}
              <button
                onClick={toggleLike}
                className={`flex items-center gap-2 text-sm font-semibold transition active:scale-110 ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}
              >
                <svg className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                {likeCount > 0 ? likeCount : (isRtl ? 'أعجبني' : 'Like')}
              </button>

              {/* Bookmark */}
              <button
                onClick={toggleBookmark}
                className={`flex items-center gap-2 text-sm font-semibold transition ${bookmarked ? 'text-purple-600' : 'text-gray-400 hover:text-purple-500'}`}
              >
                <svg className="w-5 h-5" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                {isRtl ? (bookmarked ? 'محفوظ' : 'حفظ') : (bookmarked ? 'Saved' : 'Save')}
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className={`flex items-center gap-2 text-sm font-semibold transition ${copied ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-500'}`}
              >
                {copied ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {isRtl ? 'تم النسخ!' : 'Copied!'}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                    {isRtl ? 'مشاركة' : 'Share'}
                  </>
                )}
              </button>

              <span className="ms-auto text-xs text-gray-400">
                {post.viewCount} {isRtl ? 'مشاهدة' : 'views'}
              </span>
            </div>
          )}
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

          <div className="flex gap-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user ? user.name.charAt(0) : '?'}
              </div>
            )}
            <div className="flex-1 flex gap-2 min-w-0">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
                className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
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
