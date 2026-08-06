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
}

export default function TareeqCard({ post, initialLiked = false }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();

  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showGate, setShowGate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showShareMenu) return;
    const handler = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showShareMenu]);

  const catKey = post.category as TareeqCategoryKey | null;
  const catLabel = catKey && TAREEQ_CATEGORIES[catKey]
    ? (isRtl ? TAREEQ_CATEGORIES[catKey].ar : TAREEQ_CATEGORIES[catKey].en)
    : post.category;
  const catIcon = catKey ? (CATEGORY_ICONS[catKey] ?? '') : '';
  const accentHex = catKey ? (CATEGORY_ACCENT_HEX[catKey] ?? '#d4a853') : '#d4a853';
  const snippet = post.summary || post.content.slice(0, 160);
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const hasImage = !!post.imageUrl;

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { setShowGate(true); return; }
    if ('vibrate' in navigator) navigator.vibrate(50);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => Math.max(0, wasLiked ? c - 1 : c + 1));
    const res = await fetch(`/api/tareeq/${post.id}/like`, { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      setLiked(wasLiked);
      setLikeCount(c => Math.max(0, wasLiked ? c + 1 : c - 1));
    }
  }

  async function handleCopyLink(e: React.MouseEvent) {
    e.preventDefault();
    const url = `${window.location.origin}/tareeq/${post.id}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setShowShareMenu(false);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    const url = `${window.location.origin}/tareeq/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || (isRtl ? 'علامة على طريق' : 'A mark on Tareeq'),
          text: post.content.slice(0, 100),
          url,
        });
      } catch { /* user cancelled */ }
    } else {
      setShowShareMenu(v => !v);
    }
  }

  function handleCommentToggle(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { setShowGate(true); return; }
    setShowCommentInput(v => {
      if (!v) setTimeout(() => commentInputRef.current?.focus(), 30);
      return !v;
    });
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || commentText.trim().length < 2) return;
    setSubmitting(true);
    const res = await fetch(`/api/tareeq/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content: commentText.trim() }),
    });
    if (res.ok) {
      setCommentCount(c => c + 1);
      setCommentText('');
      setShowCommentInput(false);
    }
    setSubmitting(false);
  }

  const cardStyle = {
    background: 'var(--tr-surface)',
    border: '1px solid var(--tr-border-subtle)',
    borderRadius: 16,
    overflow: 'hidden' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    transition: 'box-shadow 0.3s ease, transform 0.25s ease',
  };

  return (
    <>
      <article
        style={cardStyle}
        aria-label={post.title || post.content.slice(0, 80)}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${accentHex}20, 0 8px 24px rgba(0,0,0,0.10)`;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        {/* Category accent line — top glow bar */}
        {catKey && (
          <div style={{
            height: 2,
            background: `linear-gradient(90deg, ${accentHex}, transparent)`,
            opacity: 0.8,
          }} />
        )}

        {/* Image — full bleed */}
        {hasImage && (
          <Link href={`/tareeq/${post.id}`} className="relative w-full shrink-0 overflow-hidden block" style={{ aspectRatio: '4/3', background: 'var(--tr-raised)' }}>
            <img src={post.imageUrl!} alt="" className="w-full h-full object-cover" loading="lazy" />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, var(--tr-surface) 0%, transparent 40%)` }} />
            {catLabel && (
              <span
                className="absolute top-3 start-3 text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(0,0,0,0.48)',
                  backdropFilter: 'blur(6px)',
                  border: `1px solid ${accentHex}50`,
                  color: '#fff',
                }}
              >
                {catIcon} {catLabel}
              </span>
            )}
          </Link>
        )}

        {/* Content */}
        <Link href={`/tareeq/${post.id}`} className="flex flex-col flex-1 p-5 gap-3 min-w-0">
          {/* Author row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {post.user?.avatarUrl ? (
                <img src={post.user.avatarUrl} alt={post.authorName} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1px solid var(--tr-border-soft)' }}
                >
                  {post.authorName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                {post.userId ? (
                  <Link
                    href={`/tareeq/u/${post.userId}`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs font-semibold truncate block transition"
                    style={{ color: 'var(--tr-text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--tr-gold)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--tr-text-secondary)')}
                  >
                    {post.authorName}
                  </Link>
                ) : (
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--tr-text-secondary)' }}>{post.authorName}</p>
                )}
                <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(post.createdAt, isRtl)}</p>
              </div>
            </div>
            {/* Category badge — text-only posts */}
            {!hasImage && catLabel && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ color: accentHex, background: `${accentHex}18`, border: `1px solid ${accentHex}35` }}
              >
                {catIcon} {catLabel}
              </span>
            )}
          </div>

          {post.title && (
            <h3
              className="font-black text-sm leading-snug line-clamp-2 transition"
              style={{ color: 'var(--tr-text-primary)' }}
            >
              {post.title}
            </h3>
          )}

          <p className="text-xs leading-relaxed line-clamp-4 flex-1" style={{ color: 'var(--tr-text-secondary)' }}>
            {snippet}
          </p>

          {/* Video badge */}
          {!hasImage && post.videoUrl && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-4 py-3"
              style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-subtle)' }}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--tr-overlay)' }}>
                <svg className="w-3.5 h-3.5 ms-0.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'يحتوي على فيديو' : 'Contains a video'}
              </span>
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-subtle)' }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </Link>

        {/* Footer actions */}
        <div
          className="px-5 pb-4 pt-3 flex items-center gap-4"
          style={{ borderTop: '1px solid var(--tr-border-subtle)' }}
        >
          {/* Like */}
          <button
            onClick={handleLike}
            aria-pressed={liked}
            aria-label={isRtl ? (liked ? 'إلغاء الإعجاب' : 'إعجاب') : (liked ? 'Unlike' : 'Like')}
            className="flex items-center gap-1.5 text-xs font-semibold transition active:scale-110"
            style={{ color: liked ? '#f43f5e' : 'var(--tr-text-muted)' }}
            onMouseEnter={e => { if (!liked) (e.currentTarget as HTMLElement).style.color = '#f43f5e88'; }}
            onMouseLeave={e => { if (!liked) (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-muted)'; }}
          >
            <svg className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              style={liked ? { filter: 'drop-shadow(0 0 6px rgba(244,63,94,0.6))' } : undefined}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <span>{likeCount}</span>
          </button>

          {/* Comment */}
          <button
            onClick={handleCommentToggle}
            className="flex items-center gap-1.5 text-xs font-semibold transition"
            style={{ color: showCommentInput ? 'var(--tr-teal)' : 'var(--tr-text-muted)' }}
            onMouseEnter={e => { if (!showCommentInput) (e.currentTarget as HTMLElement).style.color = 'var(--tr-teal)'; }}
            onMouseLeave={e => { if (!showCommentInput) (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-muted)'; }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span>{commentCount}</span>
          </button>

          {/* Share — native on mobile, dropdown on desktop */}
          <div ref={shareMenuRef} className="relative ms-auto">
            <button
              onClick={handleShare}
              className="flex items-center gap-1 text-xs font-semibold transition"
              style={{ color: copied ? 'var(--tr-teal)' : 'var(--tr-text-muted)' }}
            >
              {copied ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              )}
            </button>
            {showShareMenu && (() => {
              const postUrl = typeof window !== 'undefined' ? `${window.location.origin}/tareeq/${post.id}` : `/tareeq/${post.id}`;
              const text = encodeURIComponent(post.title || post.content.slice(0, 80));
              const url = encodeURIComponent(postUrl);
              const items = [
                { label: 'Twitter / X', color: '#ffffff', href: `https://twitter.com/intent/tweet?text=${text}&url=${url}` },
                { label: 'WhatsApp', color: '#25D366', href: `https://api.whatsapp.com/send?text=${text}%20${url}` },
                { label: 'Facebook', color: '#4c8ef0', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
                { label: 'Telegram', color: '#4aaed9', href: `https://t.me/share/url?url=${url}&text=${text}` },
              ];
              return (
                <div
                  className="absolute bottom-full end-0 mb-2 py-1.5 w-36 z-20 rounded-xl"
                  style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                >
                  {items.map(item => (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => { e.stopPropagation(); setShowShareMenu(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold transition"
                      style={{ color: 'var(--tr-text-secondary)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--tr-text-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--tr-text-secondary)')}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      {item.label}
                    </a>
                  ))}
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold transition w-full"
                    style={{ color: 'var(--tr-text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--tr-text-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--tr-text-secondary)')}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--tr-text-muted)' }} />
                    {isRtl ? 'نسخ الرابط' : 'Copy link'}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Inline comment form */}
        {showCommentInput && (
          <form
            onSubmit={handleComment}
            onClick={e => e.stopPropagation()}
            className="px-5 pb-4 pt-3 flex gap-2 items-center"
            style={{ borderTop: '1px solid var(--tr-border-subtle)' }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1px solid var(--tr-border-soft)' }}
            >
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setShowCommentInput(false); } }}
              placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
              maxLength={500}
              className="flex-1 min-w-0 rounded-full px-3 py-1.5 text-xs outline-none transition"
              style={{
                background: 'var(--tr-overlay)',
                border: '1px solid var(--tr-border-soft)',
                color: 'var(--tr-text-primary)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--tr-teal)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--tr-border-soft)')}
            />
            <button
              type="submit"
              disabled={submitting || commentText.trim().length < 2}
              className="px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-40 transition shrink-0"
              style={{ background: 'var(--tr-teal-dim)', color: 'var(--tr-teal)', border: '1px solid var(--tr-teal)33' }}
            >
              {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
            </button>
          </form>
        )}
      </article>

      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </>
  );
}
