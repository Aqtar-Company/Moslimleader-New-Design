'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/tareeq-utils';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS, CATEGORY_ACCENT_HEX } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import TareeqLoginGate from './TareeqLoginGate';
import { ReportModal } from './TareeqCard';
import TareeqMentionInput from './TareeqMentionInput';

interface Props {
  postId: string;
  focusComments?: boolean;
  onClose: () => void;
  onDeleted?: (id: string) => void;
  onReacted?: (postId: string, reaction: string | null) => void;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  parentId?: string | null;
  replyCount?: number;
  likeCount?: number;
  liked?: boolean;
  user: { id: string; name: string } | null;
}

interface Post {
  id: string;
  title: string | null;
  content: string;
  imageUrl: string | null;
  authorName: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  userId: string | null;
  user: { id: string; name: string; avatarUrl?: string | null } | null;
  comments: Comment[];
  postUpdate?: string | null;
  category?: string | null;
}

const REACTIONS = [
  { type: 'inspired', emoji: '⭐', labelAr: 'ألهمني', labelEn: 'Inspiring', color: '#f59e0b' },
  { type: 'thanks',   emoji: '🙏', labelAr: 'شكرًا',  labelEn: 'Thanks',    color: '#10b981' },
  { type: 'agree',    emoji: '✊', labelAr: 'أتفق',   labelEn: 'Agree',     color: '#3b82f6' },
  { type: 'yarabb',   emoji: '🤲', labelAr: 'يارب',   labelEn: 'Ameen',     color: '#8b5cf6' },
] as const;

type ReactionType = typeof REACTIONS[number]['type'];

export default function TareeqPostSheet({ postId, focusComments = false, onClose, onDeleted, onReacted }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentLikes, setCommentLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [showGate, setShowGate] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorName: string } | null>(null);
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, Comment[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const isDragging = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  const doClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose(), 280);
  }, [onClose]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') doClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doClose]);

  // Android back button — push a history entry so back closes sheet instead of leaving page
  useEffect(() => {
    history.pushState({ tareeqSheet: postId }, '');
    const handlePop = () => { doClose(); };
    window.addEventListener('popstate', handlePop, { once: true });
    return () => window.removeEventListener('popstate', handlePop);
  }, [postId, doClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/tareeq/${postId}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/tareeq/${postId}/react`, { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetch(`/api/tareeq/${postId}/comments`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ comments: [] })),
    ]).then(([postData, reactData, commentData]) => {
      const p = postData.post ?? postData;
      if (p) setPost(p);
      const loadedComments = commentData.comments ?? p?.comments ?? [];
      setComments(loadedComments);
      seedCommentLikes(loadedComments);
      setCurrentReaction(reactData.userReaction ?? postData.userReaction ?? null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    if (focusComments && !loading && commentInputRef.current) {
      setTimeout(() => commentInputRef.current?.focus(), 300);
    }
  }, [focusComments, loading]);

  function handleTouchStart(e: React.TouchEvent) {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = e.touches[0].clientY;
    isDragging.current = true;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    dragCurrentY.current = e.touches[0].clientY;
    if (dy > 0) setDragOffset(dy);
  }

  function handleTouchEnd() {
    isDragging.current = false;
    if (dragOffset > 80) {
      doClose();
    } else {
      setDragOffset(0);
    }
  }

  async function handleReact(type: ReactionType) {
    if (!user) { setShowGate(true); return; }
    const prev = currentReaction;
    setCurrentReaction(prev === type ? null : type);
    try { navigator.vibrate?.(40); } catch { /* not supported */ }
    const res = await fetch(`/api/tareeq/${postId}/react`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const data = await res.json();
      const newReaction = data.reaction ?? null;
      setCurrentReaction(newReaction);
      onReacted?.(postId, newReaction);
    } else {
      setCurrentReaction(prev);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tareeq/${postId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        onDeleted?.(postId);
        doClose();
      }
    } catch { /* ignore */ } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function loadReplies(commentId: string) {
    if (expandedReplies[commentId]) {
      // toggle collapse
      setExpandedReplies(prev => { const n = { ...prev }; delete n[commentId]; return n; });
      return;
    }
    setLoadingReplies(prev => ({ ...prev, [commentId]: true }));
    try {
      const res = await fetch(`/api/tareeq/${postId}/comments?parentId=${commentId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setExpandedReplies(prev => ({ ...prev, [commentId]: data.comments ?? [] }));
      }
    } catch { /* offline */ } finally {
      setLoadingReplies(prev => ({ ...prev, [commentId]: false }));
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { setShowGate(true); return; }
    if (commentText.trim().length < 2) return;
    setCommentError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tareeq/${postId}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ content: commentText.trim(), parentId: replyingTo?.commentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.comment) {
          if (replyingTo) {
            setExpandedReplies(prev => ({
              ...prev,
              [replyingTo.commentId]: [...(prev[replyingTo.commentId] ?? []), data.comment],
            }));
            setComments(prev => prev.map(c =>
              c.id === replyingTo.commentId ? { ...c, replyCount: (c.replyCount ?? 0) + 1 } : c
            ));
          } else {
            setComments(prev => [...prev, data.comment]);
          }
        }
        setCommentText('');
        setReplyingTo(null);
      } else {
        setCommentError(data.error ?? (isRtl ? 'حدث خطأ، حاول مرة أخرى' : 'Error, please try again'));
      }
    } catch { setCommentError(isRtl ? 'تحقق من اتصالك بالإنترنت' : 'Check your internet connection'); } finally {
      setSubmitting(false);
    }
  }

  async function handleCommentLike(commentId: string) {
    if (!user) { setShowGate(true); return; }
    const prev = commentLikes[commentId] ?? { liked: false, count: 0 };
    // Optimistic update
    setCommentLikes(s => ({ ...s, [commentId]: { liked: !prev.liked, count: prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1 } }));
    try {
      const res = await fetch(`/api/tareeq/comments/${commentId}/react`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setCommentLikes(s => ({ ...s, [commentId]: { liked: d.liked, count: d.count } }));
      } else {
        setCommentLikes(s => ({ ...s, [commentId]: prev })); // revert
      }
    } catch { setCommentLikes(s => ({ ...s, [commentId]: prev })); }
  }

  // Seed commentLikes from loaded comments
  function seedCommentLikes(list: Comment[]) {
    setCommentLikes(prev => {
      const next = { ...prev };
      for (const c of list) {
        if (!(c.id in next)) next[c.id] = { liked: !!c.liked, count: c.likeCount ?? 0 };
      }
      return next;
    });
  }

  const catKey = post?.category as TareeqCategoryKey | null;
  const catLabel = catKey && TAREEQ_CATEGORIES[catKey]
    ? (isRtl ? TAREEQ_CATEGORIES[catKey].ar : TAREEQ_CATEGORIES[catKey].en)
    : post?.category;
  const catIcon = catKey ? (CATEGORY_ICONS[catKey] ?? '') : '';
  const accentHex = catKey ? (CATEGORY_ACCENT_HEX[catKey] ?? '#ff5c38') : '#ff5c38';

  // Detect desktop (≥1024px) — checked once after mount to avoid SSR mismatch
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => { setIsDesktop(window.innerWidth >= 1024); }, []);

  const translateY = closing ? '100%' : visible ? `${dragOffset}px` : '100%';
  const transition = (closing || !visible || dragOffset > 0)
    ? (dragOffset > 0 ? 'none' : 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)')
    : 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)';

  // ── Desktop: Facebook-style centered modal ───────────────────────────────
  if (isDesktop) {
    const desktopContent = (
      <>
        <style>{`@keyframes sheet-spin { to { transform: rotate(360deg); } } @keyframes fb-fade-in { from { opacity:0; transform:scale(0.97) } to { opacity:1; transform:scale(1) } }`}</style>
        {/* Backdrop */}
        <div onClick={doClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
        {/* Dialog */}
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, pointerEvents: 'none',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
              pointerEvents: 'auto',
              background: 'var(--tr-surface)',
              border: '1px solid var(--tr-border-soft)',
              borderRadius: 16,
              boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
              width: '100%',
              maxWidth: post?.imageUrl ? 900 : 620,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: post?.imageUrl ? 'row' : 'column',
              overflow: 'hidden',
              animation: 'fb-fade-in 180ms ease',
            }}
          >
            {/* Left: image pane (only if post has image) */}
            {post?.imageUrl && (
              <div style={{
                flex: '0 0 55%',
                background: '#0a0d06',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                minHeight: 400,
              }}>
                <img src={post.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', maxHeight: '90vh' }} />
              </div>
            )}

            {/* Right: content + comments */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxHeight: '90vh', position: 'relative' }}>
              {/* Close button — always at physical top-right */}
              <button
                onClick={doClose}
                style={{ position: 'absolute', top: 12, right: 16, zIndex: 10, width: 32, height: 32, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}
              >×</button>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 56px 12px 16px', borderBottom: '1px solid var(--tr-border-subtle)', flexShrink: 0 }}>
                {catLabel && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: accentHex, background: `${accentHex}18`, border: `1px solid ${accentHex}30`, flexShrink: 0 }}>
                    {catIcon} {catLabel}
                  </span>
                )}
                <div style={{ flex: 1 }} />
                {/* Delete option for post owner */}
                {user && post?.userId === user.id && (
                  <div style={{ position: 'relative' }}>
                    {showDeleteConfirm ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--tr-text-muted)' }}>{isRtl ? 'تأكيد الحذف؟' : 'Delete?'}</span>
                        <button onClick={handleDelete} disabled={deleting} style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>{deleting ? '...' : (isRtl ? 'نعم' : 'Yes')}</button>
                        <button onClick={() => setShowDeleteConfirm(false)} style={{ fontSize: 12, color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>{isRtl ? 'لا' : 'No'}</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowDeleteConfirm(true)} style={{ width: 32, height: 32, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', border: 'none', cursor: 'pointer', flexShrink: 0 }} title={isRtl ? 'حذف المنشور' : 'Delete post'}>
                        <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                )}
                <Link href={`/tareeq/${postId}`} onClick={doClose} style={{ width: 32, height: 32, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', textDecoration: 'none', flexShrink: 0 }} title={isRtl ? 'فتح المنشور كاملاً' : 'Open full post'}>
                  <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                </Link>
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)', animation: 'sheet-spin 0.8s linear infinite' }} />
                  </div>
                ) : post ? (
                  <>
                    {/* Author */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 10px' }}>
                      {post.user?.avatarUrl
                        ? <img src={post.user.avatarUrl} alt={post.authorName} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--tr-gold)', flexShrink: 0 }} />
                        : <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)', flexShrink: 0 }}>{post.authorName.charAt(0)}</div>
                      }
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--tr-text-primary)', margin: 0 }}>{post.authorName}</p>
                        <p style={{ fontSize: 11, color: 'var(--tr-text-muted)', margin: '2px 0 0' }}>{timeAgo(post.createdAt, isRtl)}</p>
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '0 16px 14px' }}>
                      {post.title && <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--tr-text-primary)', margin: '0 0 8px', lineHeight: 1.4 }}>{post.title}</h2>}
                      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--tr-text-secondary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.content}</p>
                      {post.postUpdate && (
                        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--tr-gold-glow)', border: '1px solid rgba(212,168,83,0.3)' }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--tr-gold)', margin: '0 0 4px' }}>{isRtl ? 'تحديث ★' : 'Update ★'}</p>
                          <p style={{ fontSize: 13, color: 'var(--tr-text-secondary)', margin: 0 }}>{post.postUpdate}</p>
                        </div>
                      )}
                    </div>

                    {/* Reactions */}
                    <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--tr-border-subtle)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                      {REACTIONS.map(r => {
                        const active = currentReaction === r.type;
                        return (
                          <button key={r.type} onClick={() => handleReact(r.type)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', background: active ? `${r.color}18` : 'var(--tr-overlay)', outline: active ? `1.5px solid ${r.color}50` : 'none', transition: 'all 150ms' }}>
                            <span style={{ fontSize: 20 }}>{r.emoji}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: active ? r.color : 'var(--tr-text-muted)' }}>{isRtl ? r.labelAr : r.labelEn}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Comments heading */}
                    <div style={{ padding: '12px 16px 6px' }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--tr-text-primary)', margin: 0 }}>{isRtl ? `التعليقات (${comments.length})` : `Comments (${comments.length})`}</p>
                    </div>

                    {/* Comments */}
                    {comments.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--tr-text-muted)', padding: '6px 16px 16px', margin: 0 }}>{isRtl ? 'لا تعليقات بعد' : 'No comments yet'}</p>
                    ) : (
                      <div style={{ paddingBottom: 12 }}>
                        {comments.map(c => (
                          <div key={c.id}>
                            <div style={{ display: 'flex', gap: 10, padding: '9px 16px', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold)' }}>{(c.user?.name ?? '?').charAt(0)}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tr-text-primary)' }}>{c.user?.name ?? (isRtl ? 'مجهول' : 'Anonymous')}</span>
                                  <span style={{ fontSize: 10, color: 'var(--tr-text-muted)' }}>{timeAgo(c.createdAt, isRtl)}</span>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--tr-text-secondary)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{c.content}</p>
                                <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
                                  <button type="button" onClick={() => setReplyingTo({ commentId: c.id, authorName: c.user?.name ?? '' })} style={{ fontSize: 11, fontWeight: 600, color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{isRtl ? 'رد' : 'Reply'}</button>
                                  {/* Heart like */}
                                  <button type="button" onClick={() => handleCommentLike(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: commentLikes[c.id]?.liked ? '#ef4444' : 'var(--tr-text-muted)', transition: 'color 150ms' }}>
                                    <span style={{ fontSize: 13 }}>{commentLikes[c.id]?.liked ? '❤️' : '🤍'}</span>
                                    {(commentLikes[c.id]?.count ?? 0) > 0 && <span>{commentLikes[c.id]?.count}</span>}
                                  </button>
                                  {user && user.id !== c.userId && (
                                    <button type="button" onClick={() => setReportCommentId(c.id)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{isRtl ? 'إبلاغ' : 'Report'}</button>
                                  )}
                                  {(c.replyCount ?? 0) > 0 && (
                                    <button onClick={() => loadReplies(c.id)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--tr-gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                      {loadingReplies[c.id] ? '...' : expandedReplies[c.id] ? (isRtl ? 'إخفاء' : 'Hide') : (isRtl ? `${c.replyCount} ردود` : `${c.replyCount} replies`)}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {expandedReplies[c.id]?.map(r => (
                              <div key={r.id} style={{ display: 'flex', gap: 8, padding: '7px 16px 7px 46px', background: 'var(--tr-overlay)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold)' }}>{(r.user?.name ?? '?').charAt(0)}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tr-text-primary)' }}>{r.user?.name ?? (isRtl ? 'مجهول' : 'Anonymous')}</span>
                                    <span style={{ fontSize: 10, color: 'var(--tr-text-muted)' }}>{timeAgo(r.createdAt, isRtl)}</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: 'var(--tr-text-secondary)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{r.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ height: 16 }} />
                  </>
                ) : (
                  <p style={{ textAlign: 'center', padding: 32, color: 'var(--tr-text-muted)', fontSize: 14 }}>{isRtl ? 'تعذّر تحميل المنشور' : 'Could not load post'}</p>
                )}
              </div>

              {/* Comment input */}
              <form onSubmit={handleComment} style={{ display: 'flex', flexDirection: 'column', gap: 0, borderTop: '1px solid var(--tr-border-subtle)', background: 'var(--tr-surface)', flexShrink: 0 }}>
                {replyingTo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', background: 'var(--tr-overlay)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                    <span style={{ fontSize: 12, color: 'var(--tr-gold)', flex: 1 }}>{isRtl ? `ردًا على ${replyingTo.authorName}` : `Replying to ${replyingTo.authorName}`}</span>
                    <button type="button" onClick={() => setReplyingTo(null)} style={{ fontSize: 16, color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
                  </div>
                )}
                {commentError && (
                  <p style={{ padding: '4px 14px 0', fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{commentError}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold)' }}>{user?.name?.charAt(0) ?? '?'}</div>
                  <TareeqMentionInput inputRef={commentInputRef} value={commentText} onValueChange={v => { setCommentText(v); if (commentError) setCommentError(null); }} placeholder={isRtl ? (replyingTo ? 'اكتب ردك...' : 'أضف تعليقاً...') : (replyingTo ? 'Write a reply...' : 'Add a comment...')} maxLength={500} style={{ borderRadius: 20, padding: '8px 14px', fontSize: 14, background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)', outline: 'none' }} onFocus={e => { if (!user) { setShowGate(true); e.currentTarget.blur(); } }} isRtl={isRtl} />
                  <button type="submit" disabled={submitting || commentText.trim().length < 2} style={{ padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: 'var(--tr-gold)', color: '#fff', border: 'none', cursor: 'pointer', opacity: submitting || commentText.trim().length < 2 ? 0.4 : 1, transition: 'opacity 150ms', flexShrink: 0 }}>{submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
        {reportCommentId && <ReportModal targetType="comment" targetId={reportCommentId} isRtl={isRtl} onClose={() => setReportCommentId(null)} />}
      </>
    );
    if (typeof document === 'undefined') return null;
    return createPortal(desktopContent, document.body);
  }

  const content = (
    <>
      <style>{`@keyframes sheet-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Backdrop */}
      <div
        onClick={doClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          opacity: visible && !closing ? 1 : 0,
          transition: 'opacity 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          height: '88dvh',
          borderRadius: '24px 24px 0 0',
          background: 'var(--tr-surface)',
          border: '1px solid var(--tr-border-soft)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transform: `translateY(${translateY})`,
          transition,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.22)',
        }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Drag handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none', padding: '12px 0 0', cursor: 'grab', flexShrink: 0 }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--tr-border-soft)', margin: '0 auto' }} />
        </div>

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px 12px', borderBottom: '1px solid var(--tr-border-subtle)', flexShrink: 0,
        }}>
          <button
            onClick={doClose}
            style={{
              width: 32, height: 32, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 700, flexShrink: 0,
            }}
          >
            ×
          </button>

          {catLabel && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              color: accentHex, background: `${accentHex}18`, border: `1px solid ${accentHex}30`,
              flexShrink: 0,
            }}>
              {catIcon} {catLabel}
            </span>
          )}

          <div style={{ flex: 1 }} />

          <Link
            href={`/tareeq/${postId}`}
            onClick={doClose}
            style={{
              width: 32, height: 32, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', textDecoration: 'none', flexShrink: 0,
            }}
            title={isRtl ? 'فتح المنشور كاملاً' : 'Open full post'}
          >
            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </Link>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '2px solid var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)',
                animation: 'sheet-spin 0.8s linear infinite',
              }} />
            </div>
          ) : post ? (
            <>
              {/* Author row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 12px' }}>
                {post.user?.avatarUrl
                  ? <img src={post.user.avatarUrl} alt={post.authorName} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--tr-gold)', flexShrink: 0 }} />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)', flexShrink: 0 }}>
                      {post.authorName.charAt(0)}
                    </div>
                }
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--tr-text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {post.authorName}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--tr-text-muted)', margin: '2px 0 0' }}>
                    {timeAgo(post.createdAt, isRtl)}
                  </p>
                </div>
              </div>

              {/* Image */}
              {post.imageUrl && (
                <div style={{ marginBottom: 12 }}>
                  <img src={post.imageUrl} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
                </div>
              )}

              {/* Content */}
              <div style={{ padding: '0 16px 16px' }}>
                {post.title && (
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--tr-text-primary)', margin: '0 0 8px', lineHeight: 1.4 }}>
                    {post.title}
                  </h2>
                )}
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--tr-text-secondary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {post.content}
                </p>

                {post.postUpdate && (
                  <div style={{
                    marginTop: 12, padding: '10px 12px', borderRadius: 12,
                    background: 'var(--tr-gold-glow)', border: '1px solid rgba(212,168,83,0.3)',
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--tr-gold)', margin: '0 0 4px' }}>
                      {isRtl ? 'تحديث ★' : 'Update ★'}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--tr-text-secondary)', margin: 0 }}>{post.postUpdate}</p>
                  </div>
                )}
              </div>

              {/* Reaction bar */}
              <div style={{
                display: 'flex', gap: 8, padding: '12px 16px',
                borderTop: '1px solid var(--tr-border-subtle)', borderBottom: '1px solid var(--tr-border-subtle)',
              }}>
                {REACTIONS.map(r => {
                  const active = currentReaction === r.type;
                  return (
                    <button
                      key={r.type}
                      onClick={() => handleReact(r.type)}
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '8px 4px', borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: active ? `${r.color}18` : 'var(--tr-overlay)',
                        outline: active ? `1.5px solid ${r.color}50` : 'none',
                        transition: 'all 150ms',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{r.emoji}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: active ? r.color : 'var(--tr-text-muted)' }}>
                        {isRtl ? r.labelAr : r.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Comments heading */}
              <div style={{ padding: '14px 16px 8px' }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--tr-text-primary)', margin: 0 }}>
                  {isRtl ? `التعليقات (${comments.length})` : `Comments (${comments.length})`}
                </p>
              </div>

              {/* Comment list */}
              {comments.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--tr-text-muted)', padding: '8px 16px 16px', margin: 0 }}>
                  {isRtl ? 'لا تعليقات بعد' : 'No comments yet'}
                </p>
              ) : (
                <div style={{ paddingBottom: 16 }}>
                  {comments.map(c => (
                    <div key={c.id}>
                      <div style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 900,
                          background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold)',
                        }}>
                          {(c.user?.name ?? '?').charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tr-text-primary)' }}>
                              {c.user?.name ?? (isRtl ? 'مجهول' : 'Anonymous')}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--tr-text-muted)' }}>
                              {timeAgo(c.createdAt, isRtl)}
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--tr-text-secondary)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {c.content}
                          </p>
                          <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setReplyingTo({ commentId: c.id, authorName: c.user?.name ?? '' })}
                              style={{ fontSize: 11, fontWeight: 600, color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              {isRtl ? 'رد' : 'Reply'}
                            </button>
                            {/* Heart like button */}
                            <button
                              type="button"
                              onClick={() => handleCommentLike(c.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: (commentLikes[c.id]?.liked) ? '#ef4444' : 'var(--tr-text-muted)', transition: 'color 150ms' }}
                            >
                              <span style={{ fontSize: 13 }}>{(commentLikes[c.id]?.liked) ? '❤️' : '🤍'}</span>
                              {(commentLikes[c.id]?.count ?? 0) > 0 && <span>{commentLikes[c.id]?.count}</span>}
                            </button>
                            {(c.replyCount ?? 0) > 0 && (
                              <button
                                onClick={() => loadReplies(c.id)}
                                style={{ fontSize: 11, fontWeight: 600, color: 'var(--tr-gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              >
                                {loadingReplies[c.id] ? '...' : expandedReplies[c.id]
                                  ? (isRtl ? 'إخفاء الردود' : 'Hide replies')
                                  : (isRtl ? `${c.replyCount} ردود` : `${c.replyCount} replies`)}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Inline replies */}
                      {expandedReplies[c.id]?.map(r => (
                        <div key={r.id} style={{ display: 'flex', gap: 8, padding: '8px 16px 8px 52px', background: 'var(--tr-overlay)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 900,
                            background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold)',
                          }}>
                            {(r.user?.name ?? '?').charAt(0)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tr-text-primary)' }}>{r.user?.name ?? (isRtl ? 'مجهول' : 'Anonymous')}</span>
                              <span style={{ fontSize: 10, color: 'var(--tr-text-muted)' }}>{timeAgo(r.createdAt, isRtl)}</span>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--tr-text-secondary)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{r.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Spacer */}
              <div style={{ height: 80 }} />
            </>
          ) : (
            <p style={{ textAlign: 'center', padding: 32, color: 'var(--tr-text-muted)', fontSize: 14 }}>
              {isRtl ? 'تعذّر تحميل المنشور' : 'Could not load post'}
            </p>
          )}
        </div>

        {/* Pinned comment input */}
        <form
          onSubmit={handleComment}
          style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            borderTop: '1px solid var(--tr-border-subtle)',
            background: 'var(--tr-surface)', flexShrink: 0,
          }}
        >
          {replyingTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--tr-overlay)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
              <span style={{ fontSize: 12, color: 'var(--tr-gold)', flex: 1 }}>
                {isRtl ? `ردًا على ${replyingTo.authorName}` : `Replying to ${replyingTo.authorName}`}
              </span>
              <button type="button" onClick={() => setReplyingTo(null)} style={{ fontSize: 16, color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          )}
          {commentError && (
            <p style={{ padding: '4px 12px 0', fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{commentError}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 900,
            background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold)',
          }}>
            {user?.name?.charAt(0) ?? '?'}
          </div>
          <TareeqMentionInput
            inputRef={commentInputRef}
            value={commentText}
            onValueChange={v => { setCommentText(v); if (commentError) setCommentError(null); }}
            placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
            maxLength={500}
            style={{ borderRadius: 20, padding: '8px 14px', fontSize: 14, background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)', outline: 'none' }}
            onFocus={e => { if (!user) { setShowGate(true); e.currentTarget.blur(); } }}
            isRtl={isRtl}
          />
          <button
            type="submit"
            disabled={submitting || commentText.trim().length < 2}
            style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              background: 'var(--tr-gold)', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: submitting || commentText.trim().length < 2 ? 0.4 : 1,
              transition: 'opacity 150ms', flexShrink: 0,
            }}
          >
            {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
          </button>
          </div>
        </form>
      </div>

      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
