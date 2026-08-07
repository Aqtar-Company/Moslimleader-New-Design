'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS, CATEGORY_ACCENT_HEX } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import { timeAgo } from '@/lib/tareeq-utils';
import TareeqLoginGate from './TareeqLoginGate';

export interface TareeqPostSummary {
  id: string;
  title?: string | null;
  summary?: string | null;
  content: string;
  category?: string | null;
  tags?: string[] | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  authorName: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  userId?: string | null;
  user?: { id: string; name: string; avatarUrl?: string | null } | null;
}

interface Props {
  post: TareeqPostSummary;
  initialLiked?: boolean;
  initialReaction?: string | null;
}

// ── Reaction config ──────────────────────────────────────────────────
const REACTIONS = [
  { type: 'inspired', emoji: '⭐', labelAr: 'ألهمني', labelEn: 'Inspiring', color: '#f59e0b' },
  { type: 'thanks',   emoji: '🙏', labelAr: 'شكرًا',  labelEn: 'Thanks',    color: '#10b981' },
  { type: 'agree',    emoji: '✊', labelAr: 'أتفق',   labelEn: 'Agree',     color: '#3b82f6' },
  { type: 'yarabb',   emoji: '🤲', labelAr: 'يارب',   labelEn: 'Ameen',     color: '#8b5cf6' },
] as const;

type ReactionType = typeof REACTIONS[number]['type'];

function reactionEmoji(type: string): string {
  return REACTIONS.find(r => r.type === type)?.emoji ?? '⭐';
}


function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export default function TareeqCard({ post, initialLiked = false, initialReaction = null }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();

  // Backward compat: if initialLiked=true but no reaction, treat as 'inspired'
  const startReaction: string | null = initialReaction ?? (initialLiked ? 'inspired' : null);

  const [currentReaction, setCurrentReaction] = useState<string | null>(startReaction);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showGate, setShowGate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showShareMenu) return;
    const h = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) setShowShareMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showShareMenu]);

  useEffect(() => {
    if (!showPicker) return;
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showPicker]);

  const catKey    = post.category as TareeqCategoryKey | null;
  const catLabel  = catKey && TAREEQ_CATEGORIES[catKey] ? (isRtl ? TAREEQ_CATEGORIES[catKey].ar : TAREEQ_CATEGORIES[catKey].en) : post.category;
  const catIcon   = catKey ? (CATEGORY_ICONS[catKey] ?? '') : '';
  const accentHex = catKey ? (CATEGORY_ACCENT_HEX[catKey] ?? '#ff5c38') : '#ff5c38';
  const snippet   = post.summary || post.content.slice(0, 160);
  const hasImage  = !!post.imageUrl;

  async function handleReact(type: ReactionType, e?: React.MouseEvent) {
    e?.preventDefault(); e?.stopPropagation();
    if (!user) { setShowGate(true); return; }
    if ('vibrate' in navigator) navigator.vibrate(40);

    const prev = currentReaction;
    // Optimistic update
    if (prev === type) {
      setCurrentReaction(null);
      setLikeCount(c => Math.max(0, c - 1));
    } else if (prev) {
      setCurrentReaction(type); // count stays the same
    } else {
      setCurrentReaction(type);
      setLikeCount(c => c + 1);
    }

    const res = await fetch(`/api/tareeq/${post.id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type }),
    });

    if (res.ok) {
      const data = await res.json();
      setCurrentReaction(data.reaction);
    } else {
      // Rollback
      setCurrentReaction(prev);
      if (prev === type) setLikeCount(c => c + 1);
      else if (!prev) setLikeCount(c => Math.max(0, c - 1));
    }
  }

  function handleReactionAreaClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { setShowGate(true); return; }
    setShowPicker(v => !v);
  }

  async function handleCopyLink(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    await navigator.clipboard.writeText(`${window.location.origin}/tareeq/${post.id}`).catch(() => {});
    setCopied(true); setShowShareMenu(false);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const url = `${window.location.origin}/tareeq/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title || (isRtl ? 'علامة على طريق' : 'A mark on Tareeq'), text: post.content.slice(0, 100), url }); }
      catch { /* cancelled */ }
    } else { setShowShareMenu(v => !v); }
  }

  function handleCommentToggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { setShowGate(true); return; }
    setShowCommentInput(v => { if (!v) setTimeout(() => commentInputRef.current?.focus(), 30); return !v; });
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user || commentText.trim().length < 2) return;
    setSubmitting(true);
    const res = await fetch(`/api/tareeq/${post.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ content: commentText.trim() }),
    });
    if (res.ok) { setCommentCount(c => c + 1); setCommentText(''); setShowCommentInput(false); }
    setSubmitting(false);
  }

  const reactionConfig = REACTIONS.find(r => r.type === currentReaction);

  // ── Image card — full-bleed portrait ────────────────────────────────
  if (hasImage) {
    return (
      <>
        <article
          className="relative overflow-hidden"
          style={{ borderRadius: 24, aspectRatio: '3/4', background: 'var(--tr-overlay)', display: 'block' }}
          aria-label={post.title || post.content.slice(0, 80)}
        >
          {/* Clickable image area */}
          <Link href={`/tareeq/${post.id}`} className="absolute inset-0 block">
            <img src={post.imageUrl!} alt="" className="w-full h-full object-cover" loading="lazy" />
            {/* Dark gradient — heavier at bottom for legibility */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.05) 70%, transparent 100%)',
            }} />
          </Link>

          {/* Category badge — top start */}
          {catLabel && (
            <div className="absolute top-4 start-4 z-10 pointer-events-none">
              <span
                className="text-[11px] font-bold px-3 py-1 rounded-full text-white"
                style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', border: `1px solid ${accentHex}70` }}
              >
                {catIcon} {catLabel}
              </span>
            </div>
          )}

          {/* Side engagement icons — vertical stack */}
          <div className="absolute end-3 z-10 flex flex-col items-center gap-4" style={{ bottom: 96 }}>
            {/* Reaction button (image card) — picker opens as bottom overlay */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleReactionAreaClick}
                aria-label={isRtl ? 'تفاعل' : 'React'}
                className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: currentReaction
                      ? `${reactionConfig?.color ?? '#f59e0b'}30`
                      : 'rgba(255,255,255,0.20)',
                    backdropFilter: 'blur(10px)',
                    border: currentReaction ? `1.5px solid ${reactionConfig?.color ?? '#f59e0b'}80` : '1.5px solid rgba(255,255,255,0.25)',
                    ...(currentReaction ? { boxShadow: `0 0 14px ${reactionConfig?.color ?? '#f59e0b'}60` } : {}),
                    fontSize: currentReaction ? 22 : 18,
                  }}
                >
                  {currentReaction
                    ? reactionEmoji(currentReaction)
                    : (
                      // Neutral sparkle — not a heart
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)">
                        <path d="M12 3l1.2 4.8L18 6.8l-3.6 3.6 1.2 5.4-3.6-2.4-3.6 2.4 1.2-5.4L6 6.8l4.8 1.2z" />
                      </svg>
                    )
                  }
                </div>
                <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                  {fmt(likeCount)}
                </span>
              </button>
            </div>

            {/* Share */}
            <div ref={shareMenuRef} className="relative flex flex-col items-center gap-1">
              <button onClick={handleShare} aria-label={isRtl ? 'مشاركة' : 'Share'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </div>
                <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                  {copied ? '✓' : (isRtl ? 'شارك' : 'Share')}
                </span>
              </button>
              {showShareMenu && <ShareDropdown postId={post.id} title={post.title} content={post.content} onCopy={handleCopyLink} onClose={() => setShowShareMenu(false)} isRtl={isRtl} />}
            </div>

            {/* Comment */}
            <button onClick={handleCommentToggle} aria-label={isRtl ? 'تعليق' : 'Comment'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: showCommentInput ? 'rgba(255,92,56,0.7)' : 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{fmt(commentCount)}</span>
            </button>
          </div>

          {/* Reaction picker — floating glass pill, centered above author strip */}
          {showPicker && (
            <div
              ref={pickerRef}
              className="absolute z-20 flex items-end gap-2"
              style={{
                bottom: 88,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(12,12,12,0.60)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 24,
                padding: '10px 14px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                whiteSpace: 'nowrap',
              }}
              onClick={e => e.stopPropagation()}
            >
              {REACTIONS.map(r => {
                const active = currentReaction === r.type;
                return (
                  <button
                    key={r.type}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReact(r.type); setShowPicker(false); }}
                    onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
                    onPointerUp={e => (e.currentTarget.style.transform = active ? 'scale(1.18) translateY(-3px)' : 'scale(1)')}
                    onPointerLeave={e => (e.currentTarget.style.transform = active ? 'scale(1.18) translateY(-3px)' : 'scale(1)')}
                    className="flex flex-col items-center gap-0.5 transition-transform"
                    style={{ transform: active ? 'scale(1.18) translateY(-3px)' : 'scale(1)' }}
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-2xl"
                      style={{
                        background: active ? `${r.color}22` : 'rgba(255,255,255,0.07)',
                        border: `1.5px solid ${active ? r.color + '70' : 'rgba(255,255,255,0.12)'}`,
                        boxShadow: active ? `0 0 14px ${r.color}55` : 'none',
                      }}
                    >
                      {r.emoji}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: active ? r.color : 'rgba(255,255,255,0.65)' }}>
                      {isRtl ? r.labelAr : r.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Bottom: author + caption (above link, z-10) */}
          <div className="absolute bottom-0 inset-x-0 z-10 p-4 pe-16 pointer-events-none">
            <div className="flex items-center gap-2.5 mb-2 pointer-events-auto">
              <Link
                href={post.userId ? `/tareeq/u/${post.userId}` : '#'}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-2"
              >
                {post.user?.avatarUrl ? (
                  <img src={post.user.avatarUrl} alt={post.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border: '2px solid rgba(255,255,255,0.4)' }} />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '2px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)' }}
                  >
                    {post.authorName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-white font-bold text-sm leading-none">{post.authorName}</p>
                  <p className="text-white/60 text-[10px] mt-0.5">{timeAgo(post.createdAt, isRtl)}</p>
                </div>
              </Link>
            </div>
            {(post.title || snippet) && (
              <p className="text-white/90 text-xs leading-relaxed line-clamp-2">
                {post.title ? <strong>{post.title} — </strong> : null}{snippet}
              </p>
            )}
          </div>

          {/* Inline comment input */}
          {showCommentInput && (
            <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4 pt-3" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}>
              <form onSubmit={handleComment} onClick={e => e.stopPropagation()} className="flex gap-2 items-center">
                <input
                  ref={commentInputRef}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setShowCommentInput(false); }}
                  placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
                  maxLength={500}
                  className="flex-1 rounded-full px-4 py-2 text-xs text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}
                />
                <button
                  type="submit"
                  disabled={submitting || commentText.trim().length < 2}
                  className="px-4 py-2 rounded-full text-xs font-bold text-white disabled:opacity-40 transition shrink-0"
                  style={{ background: 'var(--tr-gold)' }}
                >
                  {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
                </button>
              </form>
            </div>
          )}
        </article>
        {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
      </>
    );
  }

  // ── Text-only card — clean white card ────────────────────────────────
  return (
    <>
      <article
        className="overflow-hidden"
        style={{ borderRadius: 20, background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
        aria-label={post.title || post.content.slice(0, 80)}
      >
        {/* Category accent top bar */}
        {catKey && (
          <div style={{ height: 3, background: `linear-gradient(90deg, ${accentHex}, ${accentHex}40)`, borderRadius: '20px 20px 0 0' }} />
        )}

        <Link href={`/tareeq/${post.id}`} className="block p-5 pb-3">
          {/* Author row */}
          <div className="flex items-center gap-2.5 mb-3">
            {post.user?.avatarUrl ? (
              <img src={post.user.avatarUrl} alt={post.authorName} className="w-9 h-9 rounded-full object-cover shrink-0" style={{ border: '2px solid var(--tr-gold)' }} />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}
              >
                {post.authorName.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {post.userId ? (
                <Link href={`/tareeq/u/${post.userId}`} onClick={e => e.stopPropagation()} className="text-sm font-bold truncate block" style={{ color: 'var(--tr-text-primary)' }}>
                  {post.authorName}
                </Link>
              ) : (
                <p className="text-sm font-bold truncate" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</p>
              )}
              <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(post.createdAt, isRtl)}</p>
            </div>
            {catLabel && (
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                style={{ color: accentHex, background: `${accentHex}18`, border: `1px solid ${accentHex}35` }}
              >
                {catIcon} {catLabel}
              </span>
            )}
          </div>

          {post.title && (
            <h3 className="font-black text-sm leading-snug line-clamp-2 mb-2" style={{ color: 'var(--tr-text-primary)' }}>
              {post.title}
            </h3>
          )}
          <p className="text-xs leading-relaxed line-clamp-4" style={{ color: 'var(--tr-text-secondary)' }}>{snippet}</p>

          {post.videoUrl && !hasImage && (
            <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--tr-raised)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--tr-gold-glow)' }}>
                <svg className="w-3 h-3 ms-0.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'يحتوي على فيديو' : 'Contains a video'}</span>
            </div>
          )}
        </Link>

        {/* Footer actions */}
        <div className="px-5 pb-4 pt-2 flex items-center gap-4 relative" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
          {/* Single reaction button — opens picker on press */}
          <div ref={pickerRef} className="relative flex items-center gap-1.5">
            <button
              onClick={handleReactionAreaClick}
              aria-label={isRtl ? 'تفاعل' : 'React'}
              className="flex items-center gap-1.5 active:scale-90 transition-transform"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: currentReaction ? `${reactionConfig?.color ?? '#f59e0b'}18` : 'var(--tr-overlay)',
                  border: `1.5px solid ${currentReaction ? (reactionConfig?.color ?? '#f59e0b') + '50' : 'var(--tr-border-soft)'}`,
                  fontSize: currentReaction ? 16 : 13,
                  ...(currentReaction ? { boxShadow: `0 0 8px ${reactionConfig?.color ?? '#f59e0b'}40` } : {}),
                }}
              >
                {currentReaction
                  ? reactionEmoji(currentReaction)
                  : (
                    // Neutral sparkle
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--tr-text-muted)' }}>
                      <path d="M12 3l1.2 4.8L18 6.8l-3.6 3.6 1.2 5.4-3.6-2.4-3.6 2.4 1.2-5.4L6 6.8l4.8 1.2z" />
                    </svg>
                  )
                }
              </div>
              <span
                className="text-xs font-semibold"
                style={{ color: currentReaction ? (reactionConfig?.color ?? '#f59e0b') : 'var(--tr-text-muted)' }}
              >
                {fmt(likeCount)}
              </span>
            </button>

            {/* Picker popup for text cards */}
            {showPicker && (
              <div
                className="absolute bottom-full mb-2 start-0 z-20 flex items-end gap-2"
                style={{
                  background: 'var(--tr-raised)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid var(--tr-border-soft)',
                  borderRadius: 20,
                  padding: '8px 12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  whiteSpace: 'nowrap',
                }}
                onClick={e => e.stopPropagation()}
              >
                {REACTIONS.map(r => {
                  const active = currentReaction === r.type;
                  return (
                    <button
                      key={r.type}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReact(r.type, e); setShowPicker(false); }}
                      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
                      onPointerUp={e => (e.currentTarget.style.transform = active ? 'scale(1.18) translateY(-3px)' : 'scale(1)')}
                      onPointerLeave={e => (e.currentTarget.style.transform = active ? 'scale(1.18) translateY(-3px)' : 'scale(1)')}
                      className="flex flex-col items-center gap-0.5 transition-transform"
                      style={{ transform: active ? 'scale(1.18) translateY(-3px)' : 'scale(1)' }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                        style={{
                          background: active ? `${r.color}18` : 'var(--tr-overlay)',
                          border: `1.5px solid ${active ? r.color + '60' : 'var(--tr-border-soft)'}`,
                          boxShadow: active ? `0 0 10px ${r.color}40` : 'none',
                        }}
                      >
                        {r.emoji}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: active ? r.color : 'var(--tr-text-muted)' }}>
                        {isRtl ? r.labelAr : r.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleCommentToggle}
            className="flex items-center gap-1.5 text-xs font-semibold transition"
            style={{ color: showCommentInput ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            {fmt(commentCount)}
          </button>

          <div ref={shareMenuRef} className="relative ms-auto">
            <button
              onClick={handleShare}
              className="flex items-center gap-1 text-xs font-semibold transition"
              style={{ color: copied ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={copied ? 'M4.5 12.75l6 6 9-13.5' : 'M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z'} />
              </svg>
            </button>
            {showShareMenu && <ShareDropdown postId={post.id} title={post.title} content={post.content} onCopy={handleCopyLink} onClose={() => setShowShareMenu(false)} isRtl={isRtl} />}
          </div>
        </div>

        {/* Inline comment form */}
        {showCommentInput && (
          <form onSubmit={handleComment} onClick={e => e.stopPropagation()} className="px-5 pb-4 flex gap-2 items-center" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold)' }}>
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setShowCommentInput(false); }}
              placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
              maxLength={500}
              className="flex-1 min-w-0 rounded-full px-3 py-1.5 text-xs outline-none transition"
              style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--tr-gold)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--tr-border-soft)')}
            />
            <button type="submit" disabled={submitting || commentText.trim().length < 2} className="px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-40 transition shrink-0 text-white" style={{ background: 'var(--tr-gold)' }}>
              {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
            </button>
          </form>
        )}
      </article>

      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </>
  );
}

// ── Shared share dropdown ────────────────────────────────────────────
function ShareDropdown({ postId, title, content, onCopy, onClose, isRtl }: {
  postId: string; title?: string | null; content: string;
  onCopy: (e: React.MouseEvent) => void; onClose: () => void; isRtl: boolean;
}) {
  const postUrl  = typeof window !== 'undefined' ? `${window.location.origin}/tareeq/${postId}` : `/tareeq/${postId}`;
  const text     = encodeURIComponent(title || content.slice(0, 80));
  const url      = encodeURIComponent(postUrl);
  const items    = [
    { label: 'WhatsApp', color: '#25D366', href: `https://api.whatsapp.com/send?text=${text}%20${url}` },
    { label: 'Twitter / X', color: '#000', href: `https://twitter.com/intent/tweet?text=${text}&url=${url}` },
    { label: 'Telegram', color: '#4aaed9', href: `https://t.me/share/url?url=${url}&text=${text}` },
    { label: 'Facebook', color: '#4c8ef0', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
  ];
  return (
    <div
      className="absolute bottom-full end-0 mb-2 py-1.5 w-36 z-30 rounded-2xl"
      style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 8px 28px rgba(0,0,0,0.14)' }}
    >
      {items.map(item => (
        <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
          onClick={e => { e.stopPropagation(); onClose(); }}
          className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-semibold hover:opacity-70 transition"
          style={{ color: 'var(--tr-text-secondary)' }}
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
          {item.label}
        </a>
      ))}
      <button onClick={onCopy} className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-semibold w-full hover:opacity-70 transition" style={{ color: 'var(--tr-text-secondary)' }}>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--tr-text-muted)' }} />
        {isRtl ? 'نسخ الرابط' : 'Copy link'}
      </button>
    </div>
  );
}
