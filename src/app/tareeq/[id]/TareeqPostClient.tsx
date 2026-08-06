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

// ── Reaction config (shared with TareeqCard) ─────────────────────────
const REACTIONS = [
  { type: 'inspired', labelAr: 'ألهمني', labelEn: 'Inspiring', color: '#f59e0b' },
  { type: 'thanks',   labelAr: 'شكرًا',  labelEn: 'Thanks',    color: '#10b981' },
  { type: 'agree',    labelAr: 'أتفق',   labelEn: 'Agree',     color: '#3b82f6' },
  { type: 'yarabb',   labelAr: 'يارب',   labelEn: 'Ameen',     color: '#8b5cf6' },
] as const;

type ReactionType = typeof REACTIONS[number]['type'];

function ReactionIcon({ type, size = 18 }: { type: string; size?: number }) {
  const s = size;
  if (type === 'inspired') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,3 L14.5,7.7 L19.8,7.5 L17,12 L19.8,16.5 L14.5,16.3 L12,21 L9.5,16.3 L4.2,16.5 L7,12 L4.2,7.5 L9.5,7.7 Z"/>
    </svg>
  );
  if (type === 'thanks') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 013.15 0V15M6.9 7.575a1.575 1.575 0 10-3.15 0v8.175a6.75 6.75 0 006.75 6.75h2.018a5.25 5.25 0 003.712-1.538l1.732-1.732a5.25 5.25 0 001.538-3.712l.003-2.024a.668.668 0 01.198-.471 1.575 1.575 0 10-2.228-2.228 3.818 3.818 0 00-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0116.35 15m1.143-3.678a.668.668 0 01.198.471"/>
    </svg>
  );
  if (type === 'agree') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  );
  if (type === 'yarabb') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"/>
    </svg>
  );
  return null;
}

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
                        title={isRtl ? r.labelAr : r.labelEn}
                        aria-pressed={active}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition active:scale-95"
                        style={{
                          color: active ? r.color : '#9ca3af',
                          background: active ? `${r.color}18` : 'transparent',
                          border: `1.5px solid ${active ? r.color + '60' : 'transparent'}`,
                        }}
                      >
                        <ReactionIcon type={r.type} size={18} />
                        <span className="text-xs">{isRtl ? r.labelAr : r.labelEn}</span>
                      </button>
                    );
                  })}
                  <span className="text-sm font-semibold ms-1" style={{ color: currentReaction ? (REACTIONS.find(r => r.type === currentReaction)?.color ?? '#9ca3af') : '#9ca3af' }}>
                    {likeCount > 0 ? likeCount : ''}
                  </span>
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
