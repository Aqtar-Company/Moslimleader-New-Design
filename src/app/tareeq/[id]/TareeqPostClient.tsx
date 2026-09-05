'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import { ReportModal } from '@/components/tareeq/TareeqCard';
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
  pinnedCommentId?: string | null;
  postUpdate?: string | null;
  postUpdateAt?: string | null;
  seriesId?: string | null;
  seriesTitle?: string | null;
  seriesOrder?: number | null;
}

// ── Reaction config ───────────────────────────────────────────────────
const REACTIONS = [
  { type: 'inspired',    emoji: '⭐', labelAr: 'ألهمني',      labelEn: 'Inspiring',  color: '#f59e0b' },
  { type: 'thanks',      emoji: '🙏', labelAr: 'شكرًا',       labelEn: 'Thanks',     color: '#10b981' },
  { type: 'agree',       emoji: '✊', labelAr: 'أتفق',        labelEn: 'Agree',      color: '#3b82f6' },
  { type: 'yarabb',      emoji: '🤲', labelAr: 'يارب',        labelEn: 'Ameen',      color: '#8b5cf6' },
  { type: 'mashaallah',  emoji: '🌴', labelAr: 'ماشاء الله',  labelEn: 'MashaAllah', color: '#16a34a' },
] as const;

type ReactionType = typeof REACTIONS[number]['type'];

export default function TareeqPostClient({ post, userLiked = false, userBookmarked = false, userReaction = null, userSubscribed = false }: { post: Post; userLiked?: boolean; userBookmarked?: boolean; userReaction?: string | null; userSubscribed?: boolean }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  useWakeLock();

  const startReaction: string | null = userReaction ?? (userLiked ? 'inspired' : null);
  const [currentReaction, setCurrentReaction] = useState<string | null>(startReaction);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [bookmarked, setBookmarked] = useState(userBookmarked);
  const [subscribed, setSubscribed] = useState(userSubscribed);
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commentSort, setCommentSort] = useState<'asc' | 'desc'>('asc');
  const [deleting, setDeleting] = useState(false);
  const [pinnedCommentId, setPinnedCommentId] = useState<string | null>(post.pinnedCommentId ?? null);
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [showUpdateInput, setShowUpdateInput] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [updateSaving, setUpdateSaving] = useState(false);
  const [postUpdate, setPostUpdate] = useState<string | null>(post.postUpdate ?? null);
  const [showViewers, setShowViewers] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title ?? '');
  const [editContent, setEditContent] = useState(post.content);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/tareeq/${post.id}/react`)
      .then(r => r.json())
      .then(d => setReactionCounts(d.counts ?? {}))
      .catch(() => {});
  }, [post.id]);

  // Hydrate comment like counts + my-liked state from server
  useEffect(() => {
    if (post.comments.length === 0) return;
    Promise.all(
      post.comments.map(c =>
        fetch(`/api/tareeq/comments/${c.id}/react`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(d => d ? { id: c.id, count: (d.total as number) ?? 0, liked: d.reaction !== null && d.reaction !== undefined } : null)
          .catch(() => null)
      )
    ).then(results => {
      const map: Record<string, { count: number; liked: boolean }> = {};
      results.forEach(r => { if (r) map[r.id] = { count: r.count, liked: r.liked }; });
      setCommentLikes(map);
    });
  }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOwner = user && post.userId && user.id === post.userId;
  const msElapsed = Date.now() - new Date(post.createdAt).getTime();
  const canEdit = !!isOwner && msElapsed < 3_600_000;
  const minutesLeft = Math.max(0, Math.ceil((3_600_000 - msElapsed) / 60_000));
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
      setReactionCounts(rc => ({ ...rc, [type]: Math.max(0, (rc[type] ?? 1) - 1) }));
    } else if (prev) {
      setCurrentReaction(type);
      setReactionCounts(rc => ({
        ...rc,
        [prev]: Math.max(0, (rc[prev] ?? 1) - 1),
        [type]: (rc[type] ?? 0) + 1,
      }));
    } else {
      setCurrentReaction(type);
      setLikeCount(c => c + 1);
      setReactionCounts(rc => ({ ...rc, [type]: (rc[type] ?? 0) + 1 }));
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
      if (prev === type) { setLikeCount(c => c + 1); setReactionCounts(rc => ({ ...rc, [type]: (rc[type] ?? 0) + 1 })); }
      else if (!prev) { setLikeCount(c => Math.max(0, c - 1)); setReactionCounts(rc => ({ ...rc, [type]: Math.max(0, (rc[type] ?? 1) - 1) })); }
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

  async function toggleSubscribe() {
    if (!user) { setShowGate(true); return; }
    const prev = subscribed;
    setSubscribed(!prev);
    const res = await fetch(`/api/tareeq/${post.id}/subscribe`, { method: 'POST', credentials: 'include' });
    if (res.ok) { const d = await res.json(); setSubscribed(d.subscribed); }
    else setSubscribed(prev);
  }

  async function toggleCommentLike(commentId: string) {
    if (!user) { setShowGate(true); return; }
    const prev = commentLikes[commentId] ?? { count: 0, liked: false };
    const optimistic = { count: prev.liked ? prev.count - 1 : prev.count + 1, liked: !prev.liked };
    setCommentLikes(cl => ({ ...cl, [commentId]: optimistic }));
    const res = await fetch(`/api/tareeq/comments/${commentId}/react`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ type: 'heart' }),
    });
    if (res.ok) {
      const d = await res.json();
      const total = d.total ?? Object.values((d.counts ?? {}) as Record<string, number>).reduce((s: number, n: number) => s + n, 0);
      setCommentLikes(cl => ({ ...cl, [commentId]: { count: total, liked: d.reaction !== null && d.reaction !== undefined } }));
    } else {
      setCommentLikes(cl => ({ ...cl, [commentId]: prev }));
    }
  }

  async function pinComment(commentId: string) {
    if (!isOwner) return;
    const isPinned = pinnedCommentId === commentId;
    const method = isPinned ? 'DELETE' : 'POST';
    const body = isPinned ? undefined : JSON.stringify({ commentId });
    const res = await fetch(`/api/tareeq/${post.id}/pin-comment`, {
      method, credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body,
    });
    if (res.ok) setPinnedCommentId(isPinned ? null : commentId);
  }

  async function saveUpdate() {
    if (updateText.trim().length < 5) return;
    setUpdateSaving(true);
    const res = await fetch(`/api/tareeq/${post.id}/update`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update: updateText.trim() }),
    });
    setUpdateSaving(false);
    if (res.ok) { setPostUpdate(updateText.trim()); setShowUpdateInput(false); setUpdateText(''); }
  }

  async function removeUpdate() {
    const res = await fetch(`/api/tareeq/${post.id}/update`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setPostUpdate(null);
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
      setCommentText('');
      setCommentCount(c => c + 1);
      // Append directly — avoids re-fetch regression on posts with 50+ comments
      if (data.comment) setComments(prev => [...prev, data.comment]);
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--tr-base)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <article className="rounded-2xl overflow-hidden mb-6" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
          {/* Hero image */}
          {!editing && post.imageUrl && (
            <div className="w-full overflow-hidden" style={{ background: 'var(--tr-overlay)' }}>
              <img src={post.imageUrl} alt="" className="w-full object-cover max-h-[60vw] sm:max-h-[480px]" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Author row */}
            <div className="flex items-center gap-3 mb-6">
              {post.user?.avatarUrl ? (
                <img src={post.user.avatarUrl} alt={post.authorName} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold-bright)' }}>
                  {post.authorName.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</p>
                <p className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(post.createdAt, isRtl)}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {catLabel && (
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${categoryColor}`}>
                    {catIcon} {catLabel}
                  </span>
                )}
                {isOwner && !editing && (
                  <div className="flex items-center gap-1">
                    {canEdit && (
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 text-xs transition px-2 py-1.5 rounded-lg"
                      style={{ color: 'var(--tr-text-muted)', background: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--tr-text-secondary)'; e.currentTarget.style.background = 'var(--tr-raised)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--tr-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                      title={isRtl ? `متبقي ${minutesLeft} دقيقة للتعديل` : `${minutesLeft} min left to edit`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      {isRtl ? 'تعديل' : 'Edit'}
                      <span className="text-[10px] opacity-60">({minutesLeft}د)</span>
                    </button>
                    )}
                    <button
                      onClick={deletePost}
                      disabled={deleting}
                      className="flex items-center gap-1.5 text-xs transition px-2 py-1.5 rounded-lg disabled:opacity-40"
                      style={{ color: 'var(--tr-text-muted)', background: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f43f5e'; e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--tr-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      {deleting ? '...' : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          {isRtl ? 'حذف' : 'Delete'}
                        </>
                      )}
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
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition"
                  style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                />
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={8}
                  maxLength={5000}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none leading-relaxed transition"
                  style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={editSaving || editContent.trim().length < 10}
                    className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition"
                    style={{ background: 'var(--tr-gold)', color: '#fff' }}
                  >
                    {editSaving ? '...' : (isRtl ? 'حفظ' : 'Save')}
                  </button>
                  <button onClick={() => setEditing(false)} className="px-5 py-2 rounded-xl text-sm transition" style={{ color: 'var(--tr-text-secondary)', background: 'var(--tr-raised)' }}>
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {post.title && (
                  <h1 className="font-black text-xl sm:text-2xl mb-4 leading-snug" style={{ color: 'var(--tr-text-primary)' }}>{post.title}</h1>
                )}
                <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--tr-text-secondary)' }}>
                  {post.content}
                </div>
              </>
            )}

            {/* Uploaded video */}
            {!editing && post.videoUrl && (
              <div className="mt-6 rounded-2xl overflow-hidden bg-black">
                <video src={post.videoUrl} controls playsInline className="w-full max-h-[60vw] sm:max-h-[500px]" />
              </div>
            )}

            {/* YouTube embed — auto-detected from content */}
            {!editing && (() => {
              const m = post.content.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
              const ytId = m ? m[1] : null;
              if (!ytId) return null;
              return (
                <div className="mt-6 rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', border: '1px solid var(--tr-border-soft)' }}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    style={{ border: 'none', display: 'block' }}
                  />
                </div>
              );
            })()}

            {/* Series badge */}
            {!editing && post.seriesId && post.seriesTitle && (
              <div className="flex items-center gap-2 mt-5 px-3 py-2 rounded-xl" style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.22)' }}>
                <svg width={14} height={14} fill="none" stroke="var(--tr-gold)" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: 'var(--tr-gold)' }}>
                  {post.seriesTitle}
                  {post.seriesOrder != null && ` — جزء ${post.seriesOrder}`}
                </span>
              </div>
            )}

            {/* Tags */}
            {!editing && Array.isArray(post.tags) && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6 pt-6" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
                {post.tags.map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* ماذا حدث — post update */}
            {!editing && postUpdate && (
              <div className="mt-5 p-4 rounded-2xl" style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.25)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>تحديث</span>
                  {isOwner && (
                    <button onClick={removeUpdate} className="text-[11px] ms-auto" style={{ color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {isRtl ? 'حذف' : 'Remove'}
                    </button>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--tr-text-primary)' }}>{postUpdate}</p>
              </div>
            )}

            {/* Add update input — owner only, when no update yet */}
            {!editing && isOwner && !postUpdate && (
              showUpdateInput ? (
                <div className="mt-5 p-4 rounded-2xl" style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
                  <textarea
                    value={updateText}
                    onChange={e => setUpdateText(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder={isRtl ? 'ماذا حدث؟ أضف تحديثاً للقراء...' : 'What happened? Add an update...'}
                    className="w-full text-sm resize-none focus:outline-none rounded-xl px-3 py-2.5"
                    style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveUpdate} disabled={updateSaving || updateText.trim().length < 5} className="px-4 py-1.5 rounded-xl text-sm font-bold disabled:opacity-40" style={{ background: 'var(--tr-gold)', color: '#0a0d06', border: 'none', cursor: 'pointer' }}>
                      {updateSaving ? '...' : (isRtl ? 'نشر' : 'Publish')}
                    </button>
                    <button onClick={() => setShowUpdateInput(false)} className="px-4 py-1.5 rounded-xl text-sm" style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-muted)', border: 'none', cursor: 'pointer' }}>
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowUpdateInput(true)}
                  className="mt-4 flex items-center gap-2 text-xs transition"
                  style={{ color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isRtl ? 'ماذا حدث؟ أضف تحديثاً' : 'What happened? Add an update'}
                </button>
              )
            )}

            {/* Actions */}
            {!editing && (
              <div className="flex items-center gap-3 mt-6 pt-6 flex-wrap" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
                {/* Reactions bar */}
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {REACTIONS.map(r => {
                      const active = currentReaction === r.type;
                      const count = reactionCounts[r.type] ?? 0;
                      return (
                        <button
                          key={r.type}
                          onClick={() => handleReact(r.type)}
                          aria-pressed={active}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all active:scale-95"
                          style={{
                            background: active ? `${r.color}14` : 'var(--tr-raised)',
                            border: `1.5px solid ${active ? r.color + '55' : 'transparent'}`,
                            boxShadow: active ? `0 0 10px ${r.color}30` : 'none',
                          }}
                        >
                          <span style={{ fontSize: 20, filter: active ? `drop-shadow(0 0 4px ${r.color})` : 'none' }}>
                            {r.emoji}
                          </span>
                          <span className="text-xs font-bold" style={{ color: active ? r.color : 'var(--tr-text-secondary)' }}>
                            {isRtl ? r.labelAr : r.labelEn}
                          </span>
                          {count > 0 && (
                            <span className="text-xs font-black tabular-nums" style={{ color: active ? r.color : 'var(--tr-text-muted)' }}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {likeCount > 0 && (
                    <p className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>
                      {likeCount} {isRtl ? 'تفاعل إجمالاً' : 'total reactions'}
                    </p>
                  )}
                </div>

                <button
                  onClick={toggleBookmark}
                  className="flex items-center gap-2 text-sm font-semibold transition"
                  style={{ color: bookmarked ? 'var(--tr-gold-bright)' : 'var(--tr-text-muted)' }}
                >
                  <svg className="w-5 h-5" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                  {isRtl ? (bookmarked ? 'محفوظ' : 'حفظ') : (bookmarked ? 'Saved' : 'Save')}
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 text-sm font-semibold transition"
                  style={{ color: copied ? 'var(--tr-teal)' : 'var(--tr-text-muted)' }}
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

                {/* Subscribe to post */}
                {user && (
                  <button
                    onClick={toggleSubscribe}
                    className="flex items-center gap-2 text-sm font-semibold transition"
                    style={{ color: subscribed ? 'var(--tr-gold-bright)' : 'var(--tr-text-muted)' }}
                    title={isRtl ? (subscribed ? 'إلغاء متابعة الموضوع' : 'متابعة الموضوع') : (subscribed ? 'Unsubscribe' : 'Follow topic')}
                  >
                    <svg width={18} height={18} fill={subscribed ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    {isRtl ? (subscribed ? 'متابَع' : 'تابع') : (subscribed ? 'Following' : 'Follow')}
                  </button>
                )}

                {/* view count — for author, clicking shows viewer names */}
                <div className="ms-auto flex items-center gap-1 relative">
                  <button
                    onClick={() => user?.id === post.userId && setShowViewers(v => !v)}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--tr-text-muted)', cursor: user?.id === post.userId ? 'pointer' : 'default', background: 'none', border: 'none', padding: 0 }}
                  >
                    <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {post.viewCount}
                    {user?.id === post.userId && (
                      <span className="text-[10px]">{isRtl ? '▾ من شاهد' : '▾ viewers'}</span>
                    )}
                  </button>
                  {showViewers && user?.id === post.userId && (
                    <ViewersPopover postId={post.id} isRtl={isRtl} onClose={() => setShowViewers(false)} />
                  )}
                </div>
              </div>
            )}
          </div>
        </article>

        {/* Comments */}
        <section id="comments" className="rounded-2xl p-6" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'التعليقات' : 'Comments'}
              {commentCount > 0 && <span className="ms-2 font-normal text-sm" style={{ color: 'var(--tr-text-muted)' }}>({commentCount})</span>}
            </h2>
            {comments.length > 1 && (
              <button
                onClick={() => setCommentSort(s => s === 'asc' ? 'desc' : 'asc')}
                className="text-xs transition flex items-center gap-1"
                style={{ color: 'var(--tr-text-muted)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                </svg>
                {commentSort === 'asc' ? (isRtl ? 'الأحدث أولاً' : 'Newest first') : (isRtl ? 'الأقدم أولاً' : 'Oldest first')}
              </button>
            )}
          </div>

          {comments.length === 0 ? (
            <p className="text-sm mb-6" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'لا توجد تعليقات بعد' : 'No comments yet'}</p>
          ) : (
            <div className="flex flex-col gap-4 mb-6">
              {[...sortedComments].sort((a, b) => {
                if (a.id === pinnedCommentId) return -1;
                if (b.id === pinnedCommentId) return 1;
                return 0;
              }).map((c) => {
                const isPinned = c.id === pinnedCommentId;
                return (
                  <div key={c.id} className="flex gap-3 group">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: isPinned ? 'rgba(212,168,83,0.18)' : 'var(--tr-overlay)', color: isPinned ? 'var(--tr-gold)' : 'var(--tr-text-secondary)', border: isPinned ? '1.5px solid rgba(212,168,83,0.4)' : 'none' }}>
                      {c.user?.name.charAt(0) ?? '?'}
                    </div>
                    <div className="flex-1 rounded-xl px-4 py-3"
                      style={{ background: isPinned ? 'rgba(212,168,83,0.06)' : 'var(--tr-raised)', border: isPinned ? '1px solid rgba(212,168,83,0.22)' : 'none' }}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: 'var(--tr-text-primary)' }}>{c.user?.name ?? (isRtl ? 'مجهول' : 'Anonymous')}</span>
                        {isPinned && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>
                            ⭐ {isRtl ? 'أفضل رد' : 'Best Reply'}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(c.createdAt, isRtl)}</span>
                        <div className="ms-auto flex items-center gap-2">
                          {user && user.id !== c.userId && (
                            <button
                              onClick={() => setReportCommentId(c.id)}
                              title={isRtl ? 'إبلاغ عن التعليق' : 'Report comment'}
                              className="transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              style={{ color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 4.5h13.5l-1.5 4.5 1.5 4.5H3" />
                              </svg>
                            </button>
                          )}
                          {isOwner && (
                            <button
                              onClick={() => pinComment(c.id)}
                              title={isPinned ? (isRtl ? 'إلغاء التثبيت' : 'Unpin') : (isRtl ? 'تثبيت كأفضل رد' : 'Pin as best reply')}
                              className="transition opacity-0 group-hover:opacity-100"
                              style={{ color: isPinned ? 'var(--tr-gold)' : 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              <svg width={13} height={13} fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--tr-text-secondary)' }}>{c.content}</p>
                      <div className="flex items-center mt-2">
                        <button
                          onClick={() => toggleCommentLike(c.id)}
                          className="flex items-center gap-1 transition active:scale-90"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: commentLikes[c.id]?.liked ? '#f43f5e' : 'var(--tr-text-muted)', padding: '2px 0' }}
                        >
                          <svg width={14} height={14} fill={commentLikes[c.id]?.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                          </svg>
                          {(commentLikes[c.id]?.count ?? 0) > 0 && (
                            <span className="text-[11px] font-semibold">{commentLikes[c.id]?.count}</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold-bright)' }}>
                {user ? user.name.charAt(0) : '?'}
              </div>
            )}
            <div className="flex-1 flex gap-2 min-w-0">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm focus:outline-none transition"
                style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                onClick={() => { if (!user) setShowGate(true); }}
              />
              <button
                onClick={submitComment}
                disabled={submitting || commentText.trim().length < 2}
                className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition"
                style={{ background: 'var(--tr-gold)', color: '#fff' }}
              >
                {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
              </button>
            </div>
          </div>
        </section>
      </div>

      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
      {reportCommentId && <ReportModal targetType="comment" targetId={reportCommentId} isRtl={isRtl} onClose={() => setReportCommentId(null)} />}
    </div>
  );
}

function ViewersPopover({ postId, isRtl, onClose }: { postId: string; isRtl: boolean; onClose: () => void }) {
  const [data, setData] = useState<{ viewCount: number; viewers: { id: string; name: string; avatarUrl?: string | null }[] } | null>(null);

  useEffect(() => {
    fetch(`/api/tareeq/${postId}/views`, { credentials: 'include' })
      .then(r => r.json()).then(setData).catch(() => setData({ viewCount: 0, viewers: [] }));
  }, [postId]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute bottom-full mb-2 end-0 z-50 rounded-2xl shadow-xl overflow-hidden"
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)', width: 240, maxHeight: 320, overflowY: 'auto' }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="px-4 py-3 font-bold text-sm" style={{ borderBottom: '1px solid var(--tr-border-subtle)', color: 'var(--tr-text-primary)' }}>
          {isRtl ? `من شاهد (${data?.viewCount ?? '...'})` : `Viewers (${data?.viewCount ?? '...'})`}
        </div>
        {!data ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : data.viewers.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl ? 'لا مشاهدات مسجّلة بعد' : 'No logged-in viewers yet'}
          </p>
        ) : (
          <div className="py-2">
            {data.viewers.map(v => (
              <div key={v.id} className="flex items-center gap-2.5 px-4 py-2">
                {v.avatarUrl
                  ? <img src={v.avatarUrl} alt={v.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  : <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}>{v.name.charAt(0)}</div>
                }
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--tr-text-primary)' }}>{v.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
