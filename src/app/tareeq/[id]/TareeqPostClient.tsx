'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import { TAREEQ_CATEGORIES, CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import { timeAgo } from '@/lib/tareeq-utils';
import { useWakeLock } from '@/hooks/useWakeLock';

interface Comment { id: string; content: string; createdAt: string; userId: string; user: { id: string; name: string } | null; }
interface Post {
  id: string; title: string | null; content: string; summary: string | null;
  category: string | null; tags: string[] | null; imageUrl: string | null; videoUrl: string | null;
  authorName: string;
  likeCount: number; commentCount: number; viewCount: number; createdAt: string;
  userId: string | null; user: { id: string; name: string; avatarUrl?: string | null } | null;
  comments: Comment[];
}

// ── Reaction config ───────────────────────────────────────────────────
const REACTIONS = [
  { type: 'inspired', emoji: '⭐', labelAr: 'ألهمني', labelEn: 'Inspiring', color: '#f59e0b' },
  { type: 'thanks',   emoji: '🙏', labelAr: 'شكرًا',  labelEn: 'Thanks',    color: '#10b981' },
  { type: 'agree',    emoji: '✊', labelAr: 'أتفق',   labelEn: 'Agree',     color: '#3b82f6' },
  { type: 'yarabb',   emoji: '🤲', labelAr: 'يارب',   labelEn: 'Ameen',     color: '#8b5cf6' },
] as const;

type ReactionType = typeof REACTIONS[number]['type'];

export default function TareeqPostClient({ post, userLiked = false, userBookmarked = false, userReaction = null }: { post: Post; userLiked?: boolean; userBookmarked?: boolean; userReaction?: string | null }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  useWakeLock(); // Keep screen on while reading

  const startReaction: string | null = userReaction ?? (userLiked ? 'inspired' : null);
  const [currentReaction, setCurrentReaction] = useState<string | null>(startReaction);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [bookmarked, setBookmarked] = useState(userBookmarked);
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commentSort, setCommentSort] = useState<'asc' | 'desc'>('asc');
  const [deleting, setDeleting] = useState(false);

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
  const catIcon = catKey ? (CATEGORY_ICONS[catKey] ?? '') : '';
  const categoryColor = catKey ? (CATEGORY_COLORS[catKey] ?? 'bg-amber-100 text-amber-700') : 'bg-amber-100 text-amber-700';

  const sortedComments = commentSort === 'asc' ? comments : [...comments].reverse();

  async function handleReact(type: ReactionType) {
    if (!user) { setShowGate(true); return; }
    if ('vibrate' in navigator) navigator.vibrate(40);
    const prev = currentReaction;
    if (prev === type) {
      setCurrentReaction(null);
      setLikeCount(c => Math.max(0, c - 1));
    } else if (prev) {
      setCurrentReaction(type);
    } else {
      setCurrentReaction(type);
      setLikeCount(c => c + 1);
    }
    const res = await fetch(`/api/tareeq/${post.id}/react`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentReaction(data.reaction);
    } else {
      setCurrentReaction(prev);
      if (prev === type) setLikeCount(c => c + 1);
      else if (!prev) setLikeCount(c => Math.max(0, c - 1));
    }
  }

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

  async function deletePost() {
    const confirmed = window.confirm(
      isRtl ? 'هل أنت متأكد من حذف هذه العلامة؟' : 'Are you sure you want to delete this mark?'
    );
    if (!confirmed) return;
    setDeleting(true);
    const res = await fetch(`/api/tareeq/${post.id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { router.push('/tareeq'); } else { setDeleting(false); }
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
      setCommentText('');
      setCommentCount(c => c + 1);
      // Refresh full list from server
      const listRes = await fetch(`/api/tareeq/${post.id}/comments`);
      if (listRes.ok) {
        const data = await listRes.json();
        setComments(data.comments);
      }
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TareeqHeader onCreateClick={() => { if (!user) setShowGate(true); }} />
      <div className="pt-14" />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          {/* Hero image */}
          {!editing && post.imageUrl && (
            <div className="w-full overflow-hidden bg-gray-100">
              <img src={post.imageUrl} alt="" className="w-full object-cover max-h-[60vw] sm:max-h-[480px]" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Author row */}
            <div className="flex items-center gap-3 mb-6">
              {post.user?.avatarUrl ? (
                <img src={post.user.avatarUrl} alt={post.authorName} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center font-bold">
                  {post.authorName.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{post.authorName}</p>
                <p className="text-xs text-gray-400">{timeAgo(post.createdAt, isRtl)}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {catLabel && (
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${categoryColor}`}>
                    {catIcon} {catLabel}
                  </span>
                )}
                {isOwner && !editing && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditing(true)}
                      className="text-xs text-gray-400 hover:text-gray-700 transition px-2 py-1 rounded-lg hover:bg-gray-100"
                    >
                      ✏️ {isRtl ? 'تعديل' : 'Edit'}
                    </button>
                    <button
                      onClick={deletePost}
                      disabled={deleting}
                      className="text-xs text-gray-400 hover:text-red-500 transition px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-40"
                    >
                      {deleting ? '...' : `🗑 ${isRtl ? 'حذف' : 'Delete'}`}
                    </button>
                  </div>
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

            {/* Video */}
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
                {/* Reactions bar */}
                <div className="flex items-center gap-1 flex-wrap">
                  {REACTIONS.map(r => {
                    const active = currentReaction === r.type;
                    return (
                      <button
                        key={r.type}
                        onClick={() => handleReact(r.type)}
                        aria-pressed={active}
                        className="flex items-center gap-2 px-3 py-2 rounded-full transition-all active:scale-95"
                        style={{
                          background: active ? `${r.color}14` : '#f3f4f6',
                          border: `1.5px solid ${active ? r.color + '55' : 'transparent'}`,
                          boxShadow: active ? `0 0 10px ${r.color}30` : 'none',
                        }}
                      >
                        <span style={{ fontSize: 20, filter: active ? `drop-shadow(0 0 4px ${r.color})` : 'none' }}>
                          {r.emoji}
                        </span>
                        <span className="text-xs font-bold" style={{ color: active ? r.color : '#6b7280' }}>
                          {isRtl ? r.labelAr : r.labelEn}
                        </span>
                      </button>
                    );
                  })}
                  {likeCount > 0 && (
                    <span className="text-sm font-bold ms-1" style={{ color: currentReaction ? (REACTIONS.find(r => r.type === currentReaction)?.color ?? '#9ca3af') : '#9ca3af' }}>
                      {likeCount}
                    </span>
                  )}
                </div>

                <button
                  onClick={toggleBookmark}
                  className={`flex items-center gap-2 text-sm font-semibold transition ${bookmarked ? 'text-purple-600' : 'text-gray-400 hover:text-purple-500'}`}
                >
                  <svg className="w-5 h-5" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                  {isRtl ? (bookmarked ? 'محفوظ' : 'حفظ') : (bookmarked ? 'Saved' : 'Save')}
                </button>

                <button
                  onClick={handleShare}
                  className={`flex items-center gap-2 text-sm font-semibold transition ${copied ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-500'}`}
                >
                  {copied ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                  )}
                  {copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'مشاركة' : 'Share')}
                </button>

                <span className="ms-auto text-xs text-gray-400">
                  {post.viewCount} {isRtl ? 'مشاهدة' : 'views'}
                </span>
              </div>
            )}
          </div>
        </article>

        {/* Comments */}
        <section id="comments" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-black text-gray-900 text-base">
              💬 {isRtl ? 'التعليقات' : 'Comments'}
              {commentCount > 0 && <span className="ms-2 text-gray-400 font-normal text-sm">({commentCount})</span>}
            </h2>
            {comments.length > 1 && (
              <button
                onClick={() => setCommentSort(s => s === 'asc' ? 'desc' : 'asc')}
                className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                </svg>
                {commentSort === 'asc' ? (isRtl ? 'الأحدث أولاً' : 'Newest first') : (isRtl ? 'الأقدم أولاً' : 'Oldest first')}
              </button>
            )}
          </div>

          {comments.length === 0 ? (
            <p className="text-gray-400 text-sm mb-6">{isRtl ? 'لا توجد تعليقات بعد' : 'No comments yet'}</p>
          ) : (
            <div className="space-y-4 mb-6">
              {sortedComments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0">
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
                className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition"
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
