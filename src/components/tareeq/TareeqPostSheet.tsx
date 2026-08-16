'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/tareeq-utils';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS, CATEGORY_ACCENT_HEX } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import TareeqLoginGate from './TareeqLoginGate';

interface Props {
  postId: string;
  focusComments?: boolean;
  onClose: () => void;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
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

export default function TareeqPostSheet({ postId, focusComments = false, onClose }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showGate, setShowGate] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

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
    ]).then(([postData, reactData]) => {
      const p = postData.post ?? postData;
      if (p) {
        setPost(p);
        setComments(p.comments ?? []);
      }
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
    const res = await fetch(`/api/tareeq/${postId}/react`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentReaction(data.reaction ?? null);
    } else {
      setCurrentReaction(prev);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { setShowGate(true); return; }
    if (commentText.trim().length < 2) return;
    setSubmitting(true);
    const res = await fetch(`/api/tareeq/${postId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ content: commentText.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.comment) setComments(prev => [...prev, data.comment]);
      setCommentText('');
    }
    setSubmitting(false);
  }

  const catKey = post?.category as TareeqCategoryKey | null;
  const catLabel = catKey && TAREEQ_CATEGORIES[catKey]
    ? (isRtl ? TAREEQ_CATEGORIES[catKey].ar : TAREEQ_CATEGORIES[catKey].en)
    : post?.category;
  const catIcon = catKey ? (CATEGORY_ICONS[catKey] ?? '') : '';
  const accentHex = catKey ? (CATEGORY_ACCENT_HEX[catKey] ?? '#ff5c38') : '#ff5c38';

  const translateY = closing ? '100%' : visible ? `${dragOffset}px` : '100%';
  const transition = (closing || !visible || dragOffset > 0)
    ? (dragOffset > 0 ? 'none' : 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)')
    : 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)';

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
                    <div key={c.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--tr-border-subtle)' }}>
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
                      </div>
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
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--tr-border-subtle)',
            background: 'var(--tr-surface)', flexShrink: 0,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 900,
            background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold)',
          }}>
            {user?.name?.charAt(0) ?? '?'}
          </div>
          <input
            ref={commentInputRef}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
            maxLength={500}
            style={{
              flex: 1, minWidth: 0, borderRadius: 20, padding: '8px 14px', fontSize: 14,
              background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)',
              color: 'var(--tr-text-primary)', outline: 'none',
            }}
            onFocus={e => { if (!user) { setShowGate(true); e.currentTarget.blur(); } }}
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
        </form>
      </div>

      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
