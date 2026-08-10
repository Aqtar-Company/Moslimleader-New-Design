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
  initialBookmarked?: boolean;
}

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

/* ── Shared icon atoms ─────────────────────────────────────────────── */
function IconStar({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}
function IconComment({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}
function IconShare({ size = 18, check = false }: { size?: number; check?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={check ? 'M4.5 12.75l6 6 9-13.5' : 'M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z'} />
    </svg>
  );
}
function IconBookmark({ filled = false, size = 18 }: { filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
    </svg>
  );
}

/* ── Reaction picker popup ─────────────────────────────────────────── */
function ReactionPicker({ currentReaction, onReact, onClose, isRtl, dark = false }: {
  currentReaction: string | null;
  onReact: (type: ReactionType) => void;
  onClose: () => void;
  isRtl: boolean;
  dark?: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[49]" onClick={onClose} />
      <div
        className="absolute bottom-full start-0 z-50 flex items-end gap-1.5 mb-2"
        style={{
          background: dark ? 'rgba(12,12,12,0.72)' : 'var(--tr-surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'var(--tr-border-soft)'}`,
          borderRadius: 20,
          padding: '8px 12px',
          boxShadow: '0 8px 32px var(--tr-shadow-popup)',
          whiteSpace: 'nowrap',
        }}
        onClick={e => e.stopPropagation()}
      >
        {REACTIONS.map(r => {
          const active = currentReaction === r.type;
          return (
            <button
              key={r.type}
              onClick={() => { onReact(r.type); onClose(); }}
              className="flex flex-col items-center gap-0.5 transition-transform"
              style={{ transform: active ? 'scale(1.18) translateY(-4px)' : 'scale(1)' }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
              onPointerUp={e => (e.currentTarget.style.transform = active ? 'scale(1.18) translateY(-4px)' : 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = active ? 'scale(1.18) translateY(-4px)' : 'scale(1)')}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                style={{
                  background: active ? `${r.color}22` : (dark ? 'rgba(255,255,255,0.08)' : 'var(--tr-overlay)'),
                  border: `1.5px solid ${active ? r.color + '70' : (dark ? 'rgba(255,255,255,0.14)' : 'var(--tr-border-soft)')}`,
                  boxShadow: active ? `0 0 12px ${r.color}55` : 'none',
                  transition: 'all 150ms',
                }}
              >
                {r.emoji}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: active ? r.color : (dark ? 'rgba(255,255,255,0.6)' : 'var(--tr-text-muted)') }}>
                {isRtl ? r.labelAr : r.labelEn}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function TareeqCard({ post, initialLiked = false, initialReaction = null, initialBookmarked = false }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();

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
  const [textExpanded, setTextExpanded] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [showBookmarkPicker, setShowBookmarkPicker] = useState(false);
  const [bmFolders, setBmFolders] = useState<{ id: string; name: string; _count: { bookmarks: number } }[]>([]);
  const [bmFoldersLoaded, setBmFoldersLoaded] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showShareMenu) return;
    const h = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) setShowShareMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showShareMenu]);

  const catKey    = post.category as TareeqCategoryKey | null;
  const catLabel  = catKey && TAREEQ_CATEGORIES[catKey] ? (isRtl ? TAREEQ_CATEGORIES[catKey].ar : TAREEQ_CATEGORIES[catKey].en) : post.category;
  const catIcon   = catKey ? (CATEGORY_ICONS[catKey] ?? '') : '';
  const accentHex = catKey ? (CATEGORY_ACCENT_HEX[catKey] ?? '#ff5c38') : '#ff5c38';
  const snippet   = post.summary || post.content.slice(0, 200);
  const hasImage  = !!post.imageUrl;

  const reactionConfig = REACTIONS.find(r => r.type === currentReaction);

  async function handleReact(type: ReactionType, e?: React.MouseEvent) {
    e?.preventDefault(); e?.stopPropagation();
    if (!user) { setShowGate(true); return; }
    if ('vibrate' in navigator) navigator.vibrate(40);
    const prev = currentReaction;
    if (prev === type) { setCurrentReaction(null); setLikeCount(c => Math.max(0, c - 1)); }
    else if (prev) { setCurrentReaction(type); }
    else { setCurrentReaction(type); setLikeCount(c => c + 1); }
    const res = await fetch(`/api/tareeq/${post.id}/react`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ type }),
    });
    if (res.ok) { const data = await res.json(); setCurrentReaction(data.reaction); }
    else {
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

  async function handleBookmarkClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { setShowGate(true); return; }
    if (isBookmarked) {
      setIsBookmarked(false);
      await fetch(`/api/tareeq/bookmarks?postId=${post.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => setIsBookmarked(true));
      return;
    }
    if (!bmFoldersLoaded) {
      const res = await fetch('/api/tareeq/bookmark-folders', { credentials: 'include' }).catch(() => null);
      if (res?.ok) { const d = await res.json(); setBmFolders(d.folders ?? []); }
      setBmFoldersLoaded(true);
    }
    setShowBookmarkPicker(true);
  }

  async function handleBookmarkSave(folderId: string | null) {
    setShowBookmarkPicker(false);
    setIsBookmarked(true);
    const res = await fetch('/api/tareeq/bookmarks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ postId: post.id, folderId }),
    });
    if (!res.ok) setIsBookmarked(false);
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim() || creatingFolder) return;
    setCreatingFolder(true);
    const res = await fetch('/api/tareeq/bookmark-folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    if (res.ok) { const d = await res.json(); setBmFolders(prev => [...prev, d.folder]); setNewFolderName(''); }
    setCreatingFolder(false);
  }

  /* ── Shared comment form ─────────────────────────────────────────── */
  const commentForm = showCommentInput ? (
    <form onSubmit={handleComment} onClick={e => e.stopPropagation()} className="px-4 pb-3 pt-2 flex gap-2 items-center" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold)' }}>
        {user?.name?.charAt(0) ?? '?'}
      </div>
      <input
        ref={commentInputRef}
        value={commentText}
        onChange={e => setCommentText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') setShowCommentInput(false); }}
        placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
        maxLength={500}
        className="flex-1 min-w-0 rounded-full px-3 py-1.5 text-sm outline-none transition"
        style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--tr-gold)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--tr-border-soft)')}
      />
      <button type="submit" disabled={submitting || commentText.trim().length < 2} className="px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-40 transition shrink-0 text-white" style={{ background: 'var(--tr-gold)' }}>
        {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
      </button>
    </form>
  ) : null;

  /* ── Desktop action bar (labeled buttons) ───────────────────────── */
  function DesktopActionBar() {
    const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, transition: 'background 150ms', background: 'transparent', border: 'none', cursor: 'pointer' };
    const hover = { background: 'var(--tr-overlay)' };
    return (
      <div className="px-2 py-1 flex items-center gap-0.5" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>

        {/* React */}
        <div className="relative">
          <button
            onClick={handleReactionAreaClick}
            style={{ ...btnBase, color: currentReaction ? (reactionConfig?.color ?? 'var(--tr-gold)') : 'var(--tr-text-secondary)' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, hover)}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {currentReaction
              ? <span style={{ fontSize: 16 }}>{reactionEmoji(currentReaction)}</span>
              : <IconStar size={17} />
            }
            <span>{isRtl ? (currentReaction ? (reactionConfig?.labelAr ?? 'تفاعل') : 'تفاعل') : (currentReaction ? (reactionConfig?.labelEn ?? 'React') : 'React')}</span>
            {likeCount > 0 && <span style={{ color: 'var(--tr-text-muted)', fontSize: 12 }}>{fmt(likeCount)}</span>}
          </button>

          {showPicker && (
            <ReactionPicker
              currentReaction={currentReaction}
              onReact={(t) => handleReact(t)}
              onClose={() => setShowPicker(false)}
              isRtl={isRtl}
            />
          )}
        </div>

        {/* Comment */}
        <button
          onClick={handleCommentToggle}
          style={{ ...btnBase, color: showCommentInput ? 'var(--tr-gold)' : 'var(--tr-text-secondary)' }}
          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, hover)}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <IconComment size={17} />
          <span>{isRtl ? 'تعليق' : 'Comment'}</span>
          {commentCount > 0 && <span style={{ color: 'var(--tr-text-muted)', fontSize: 12 }}>{fmt(commentCount)}</span>}
        </button>

        {/* Share */}
        <div ref={shareMenuRef} className="relative ms-auto">
          <button
            onClick={handleShare}
            style={{ ...btnBase, color: copied ? 'var(--tr-gold)' : 'var(--tr-text-secondary)' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, hover)}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <IconShare size={17} check={copied} />
            <span>{isRtl ? 'مشاركة' : 'Share'}</span>
          </button>
          {showShareMenu && <ShareDropdown postId={post.id} title={post.title} content={post.content} onCopy={handleCopyLink} onClose={() => setShowShareMenu(false)} isRtl={isRtl} />}
        </div>

        {/* Bookmark */}
        <button
          onClick={handleBookmarkClick}
          aria-label={isRtl ? 'حفظ' : 'Save'}
          style={{ ...btnBase, color: isBookmarked ? 'var(--tr-gold)' : 'var(--tr-text-muted)', padding: '8px 10px' }}
          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, hover)}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <IconBookmark filled={isBookmarked} size={17} />
        </button>
      </div>
    );
  }

  /* ── Social summary row ─────────────────────────────────────────── */
  function SocialSummary() {
    if (likeCount <= 0 && commentCount <= 0) return null;
    return (
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
        {likeCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--tr-text-muted)' }}>
            {currentReaction ? reactionEmoji(currentReaction) : '⭐'}
            <span>{fmt(likeCount)}</span>
          </span>
        )}
        {commentCount > 0 && (
          <button onClick={handleCommentToggle} className="text-xs ms-auto transition hover:underline" style={{ color: 'var(--tr-text-muted)' }}>
            {fmt(commentCount)} {isRtl ? 'تعليق' : 'comments'}
          </button>
        )}
      </div>
    );
  }

  /* ── IMAGE CARD (single responsive article) ────────────────────── */
  if (hasImage) {
    return (
      <>
        <article
          className="relative overflow-hidden rounded-[24px] lg:rounded-[14px]"
          style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          aria-label={post.title || post.content.slice(0, 80)}
        >
          {/* Image container: portrait on mobile, landscape on desktop */}
          <div className="relative aspect-[3/4] lg:aspect-auto lg:h-[320px] overflow-hidden">
            <Link href={`/tareeq/${post.id}`} className="block w-full h-full">
              <img src={post.imageUrl!} alt="" className="w-full h-full object-cover" loading="eager" referrerPolicy="no-referrer" />
              {/* Mobile gradient — bottom-heavy overlay */}
              <div className="absolute inset-0 lg:hidden" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.05) 70%, transparent 100%)' }} />
              {/* Desktop gradient — subtle top-to-bottom */}
              <div className="absolute inset-0 hidden lg:block" style={{ background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.10) 100%)', pointerEvents: 'none' }} />
            </Link>

            {/* Category badge */}
            {catLabel && (
              <div className="absolute top-4 start-4 z-10 pointer-events-none">
                <span className="lg:hidden text-[11px] font-bold px-3 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', border: `1px solid ${accentHex}70` }}>
                  {catIcon} {catLabel}
                </span>
                <span className="hidden lg:inline text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: accentHex, background: 'rgba(255,255,255,0.95)', border: `1px solid ${accentHex}35` }}>
                  {catIcon} {catLabel}
                </span>
              </div>
            )}

            {/* ── MOBILE ONLY: floating side engagement icons ── */}
            <div className="absolute end-3 z-10 flex flex-col items-center gap-4 lg:hidden" style={{ bottom: 96 }}>
              <div className="relative flex flex-col items-center gap-1">
                <button onClick={handleReactionAreaClick} aria-label={isRtl ? 'تفاعل' : 'React'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: currentReaction ? `${reactionConfig?.color ?? '#f59e0b'}30` : 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)', border: currentReaction ? `1.5px solid ${reactionConfig?.color ?? '#f59e0b'}80` : '1.5px solid rgba(255,255,255,0.25)', fontSize: currentReaction ? 22 : 18 }}>
                    {currentReaction ? reactionEmoji(currentReaction) : <svg width={20} height={20} viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)"><path d="M12 3l1.2 4.8L18 6.8l-3.6 3.6 1.2 5.4-3.6-2.4-3.6 2.4 1.2-5.4L6 6.8l4.8 1.2z" /></svg>}
                  </div>
                  <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{fmt(likeCount)}</span>
                </button>
                {showPicker && (
                  <div className="absolute end-full me-2 bottom-0 z-20" onClick={e => e.stopPropagation()}>
                    <ReactionPicker currentReaction={currentReaction} onReact={(t) => handleReact(t)} onClose={() => setShowPicker(false)} isRtl={isRtl} dark />
                  </div>
                )}
              </div>

              <div ref={shareMenuRef} className="relative flex flex-col items-center gap-1">
                <button onClick={handleShare} aria-label={isRtl ? 'مشاركة' : 'Share'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)' }}>
                    <IconShare size={20} check={copied} />
                  </div>
                  <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{copied ? '✓' : (isRtl ? 'شارك' : 'Share')}</span>
                </button>
                {showShareMenu && <ShareDropdown postId={post.id} title={post.title} content={post.content} onCopy={handleCopyLink} onClose={() => setShowShareMenu(false)} isRtl={isRtl} />}
              </div>

              <button onClick={handleCommentToggle} aria-label={isRtl ? 'تعليق' : 'Comment'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: showCommentInput ? 'rgba(255,92,56,0.7)' : 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)' }}>
                  <IconComment size={20} />
                </div>
                <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{fmt(commentCount)}</span>
              </button>

              <button onClick={handleBookmarkClick} aria-label={isRtl ? 'حفظ' : 'Save'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                <div className="w-11 h-11 rounded-full flex items-center justify-center transition" style={{ background: isBookmarked ? 'rgba(212,168,83,0.35)' : 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)', border: isBookmarked ? '1.5px solid rgba(212,168,83,0.6)' : 'none', color: isBookmarked ? '#d4a853' : '#fff' }}>
                  <IconBookmark filled={isBookmarked} size={20} />
                </div>
                <span className="text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', color: isBookmarked ? '#d4a853' : '#fff' }}>{isRtl ? 'حفظ' : 'Save'}</span>
              </button>
            </div>

            {/* ── MOBILE ONLY: bottom author + caption overlay ── */}
            <div className="absolute bottom-0 inset-x-0 z-10 p-4 pe-16 pointer-events-none lg:hidden">
              <div className="flex items-center gap-2.5 mb-2 pointer-events-auto">
                <Link href={post.userId ? `/tareeq/u/${post.userId}` : '#'} onClick={e => e.stopPropagation()} className="flex items-center gap-2">
                  {post.user?.avatarUrl
                    ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border: '2px solid rgba(255,255,255,0.4)' }} />
                    : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '2px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)' }}>{post.authorName.charAt(0)}</div>
                  }
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

            {/* ── MOBILE ONLY: comment input overlay ── */}
            {showCommentInput && (
              <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4 pt-3 lg:hidden" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}>
                <form onSubmit={handleComment} onClick={e => e.stopPropagation()} className="flex gap-2 items-center">
                  <input ref={commentInputRef} value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setShowCommentInput(false); }} placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'} maxLength={500} className="flex-1 rounded-full px-4 py-2 text-xs text-white outline-none" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }} />
                  <button type="submit" disabled={submitting || commentText.trim().length < 2} className="px-4 py-2 rounded-full text-xs font-bold text-white disabled:opacity-40 transition shrink-0" style={{ background: 'var(--tr-gold)' }}>
                    {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* ── DESKTOP ONLY: author + text + action bars ── */}
          <div className="hidden lg:block">
            <div className="px-4 pt-3.5 pb-2">
              <div className="flex items-center gap-2.5 mb-2.5">
                {post.user?.avatarUrl
                  ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-9 h-9 rounded-full object-cover shrink-0" style={{ border: '2px solid var(--tr-gold)' }} />
                  : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}>{post.authorName.charAt(0)}</div>
                }
                <div className="flex-1 min-w-0">
                  {post.userId
                    ? <Link href={`/tareeq/u/${post.userId}`} onClick={e => e.stopPropagation()} className="text-sm font-semibold truncate block hover:underline" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</Link>
                    : <p className="text-sm font-semibold truncate" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</p>
                  }
                  <p className="text-xs mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(post.createdAt, isRtl)}</p>
                </div>
              </div>
              <Link href={`/tareeq/${post.id}`} className="block">
                {post.title && <h3 className="font-bold text-sm leading-snug mb-1.5 hover:underline" style={{ color: 'var(--tr-text-primary)' }}>{post.title}</h3>}
                {snippet && <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--tr-text-secondary)' }}>{snippet}</p>}
              </Link>
            </div>
            <SocialSummary />
            <DesktopActionBar />
            {commentForm}
          </div>
        </article>

        {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
        {showBookmarkPicker && <BookmarkPicker isRtl={isRtl} folders={bmFolders} newFolderName={newFolderName} setNewFolderName={setNewFolderName} creatingFolder={creatingFolder} onSave={handleBookmarkSave} onCreate={handleCreateFolder} onClose={() => setShowBookmarkPicker(false)} />}
      </>
    );
  }

  /* ── TEXT CARD ──────────────────────────────────────────────────── */
  const isLong = post.content.length > 220 || post.content.split('\n').length > 4;
  const isTextOnly = !post.imageUrl && !post.videoUrl;

  return (
    <>
      <article
        className="overflow-hidden"
        style={{
          borderRadius: 14,
          background: isTextOnly
            ? 'linear-gradient(135deg, rgba(251,191,36,0.13) 0%, rgba(236,72,153,0.09) 60%, rgba(251,191,36,0.07) 100%)'
            : 'var(--tr-surface)',
          border: isTextOnly
            ? '1px solid rgba(251,191,36,0.22)'
            : '1px solid var(--tr-border-subtle)',
          boxShadow: isTextOnly
            ? '0 1px 8px rgba(251,191,36,0.08), 0 1px 4px rgba(0,0,0,0.04)'
            : '0 1px 4px rgba(0,0,0,0.05)',
        }}
        aria-label={post.title || post.content.slice(0, 80)}
      >
        {/* Category accent top bar */}
        {catKey && (
          <div style={{ height: 3, background: `linear-gradient(90deg, ${accentHex}, ${accentHex}40)`, borderRadius: '14px 14px 0 0' }} />
        )}

        <Link href={`/tareeq/${post.id}`} className="block px-4 pt-4 pb-3">
          {/* Author row */}
          <div className="flex items-center gap-2.5 mb-3">
            {post.user?.avatarUrl
              ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-9 h-9 rounded-full object-cover shrink-0" style={{ border: '2px solid var(--tr-gold)' }} />
              : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}>{post.authorName.charAt(0)}</div>
            }
            <div className="flex-1 min-w-0">
              {post.userId
                ? <Link href={`/tareeq/u/${post.userId}`} onClick={e => e.stopPropagation()} className="text-sm font-semibold truncate block hover:underline" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</Link>
                : <p className="text-sm font-semibold truncate" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</p>
              }
              <p className="text-xs mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(post.createdAt, isRtl)}</p>
            </div>
            {catLabel && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ color: accentHex, background: `${accentHex}14`, border: `1px solid ${accentHex}30` }}>
                {catIcon} {catLabel}
              </span>
            )}
          </div>

          {post.title && (
            <h3 className="font-bold text-[15px] leading-snug mb-2" style={{ color: 'var(--tr-text-primary)' }}>{post.title}</h3>
          )}

          <p
            className="text-sm leading-relaxed"
            style={{
              color: 'var(--tr-text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              ...(isLong && !textExpanded ? { display: '-webkit-box', WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: 4, overflow: 'hidden' } : {}),
            }}
          >
            {textExpanded ? post.content : snippet}
          </p>
          {isLong && !textExpanded && (
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setTextExpanded(true); }} className="text-xs font-bold mt-1.5 transition" style={{ color: 'var(--tr-gold)' }}>
              {isRtl ? 'اقرأ أكثر' : 'Read more'}
            </button>
          )}

          {post.videoUrl && !hasImage && (
            <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--tr-raised)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--tr-gold-glow)' }}>
                <svg className="w-3 h-3 ms-0.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}><path d="M8 5v14l11-7z" /></svg>
              </div>
              <span className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'يحتوي على فيديو' : 'Contains a video'}</span>
            </div>
          )}
        </Link>

        {/* Social summary - desktop */}
        <div className="hidden lg:block">
          <SocialSummary />
        </div>

        {/* Desktop action bar */}
        <div className="hidden lg:block">
          <DesktopActionBar />
        </div>

        {/* Mobile action bar */}
        <div className="lg:hidden px-4 pb-3 pt-2 flex items-center gap-3 relative" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
          <div className="relative flex items-center gap-1.5">
            <button onClick={handleReactionAreaClick} aria-label={isRtl ? 'تفاعل' : 'React'} className="flex items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: currentReaction ? `${reactionConfig?.color ?? '#f59e0b'}18` : 'var(--tr-overlay)', border: `1.5px solid ${currentReaction ? (reactionConfig?.color ?? '#f59e0b') + '50' : 'var(--tr-border-soft)'}`, fontSize: currentReaction ? 16 : 13 }}>
                {currentReaction ? reactionEmoji(currentReaction) : <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--tr-text-muted)' }}><path d="M12 3l1.2 4.8L18 6.8l-3.6 3.6 1.2 5.4-3.6-2.4-3.6 2.4 1.2-5.4L6 6.8l4.8 1.2z" /></svg>}
              </div>
              <span className="text-xs font-semibold" style={{ color: currentReaction ? (reactionConfig?.color ?? '#f59e0b') : 'var(--tr-text-muted)' }}>{fmt(likeCount)}</span>
            </button>
            {showPicker && (
              <ReactionPicker currentReaction={currentReaction} onReact={(t) => handleReact(t)} onClose={() => setShowPicker(false)} isRtl={isRtl} />
            )}
          </div>

          <button onClick={handleCommentToggle} className="flex items-center gap-1.5 text-xs font-semibold transition" style={{ color: showCommentInput ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
            <IconComment size={16} />
            {fmt(commentCount)}
          </button>

          <button onClick={handleBookmarkClick} aria-label={isRtl ? 'حفظ' : 'Save'} className="flex items-center gap-1 text-xs font-semibold transition active:scale-90" style={{ color: isBookmarked ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
            <IconBookmark filled={isBookmarked} size={16} />
          </button>

          <div ref={shareMenuRef} className="relative ms-auto">
            <button onClick={handleShare} className="flex items-center gap-1 text-xs font-semibold transition" style={{ color: copied ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
              <IconShare size={16} check={copied} />
            </button>
            {showShareMenu && <ShareDropdown postId={post.id} title={post.title} content={post.content} onCopy={handleCopyLink} onClose={() => setShowShareMenu(false)} isRtl={isRtl} />}
          </div>
        </div>

        {commentForm}
      </article>

      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
      {showBookmarkPicker && <BookmarkPicker isRtl={isRtl} folders={bmFolders} newFolderName={newFolderName} setNewFolderName={setNewFolderName} creatingFolder={creatingFolder} onSave={handleBookmarkSave} onCreate={handleCreateFolder} onClose={() => setShowBookmarkPicker(false)} />}
    </>
  );
}

/* ── Bookmark folder picker ────────────────────────────────────────── */
function BookmarkPicker({ isRtl, folders, newFolderName, setNewFolderName, creatingFolder, onSave, onCreate, onClose }: {
  isRtl: boolean;
  folders: { id: string; name: string; _count: { bookmarks: number } }[];
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  creatingFolder: boolean;
  onSave: (folderId: string | null) => void;
  onCreate: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl p-6 pb-10" style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'احفظ في تصنيف' : 'Save to folder'}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>✕</button>
        </div>
        <button onClick={() => onSave(null)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-2 transition text-start" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
          <span className="text-lg">🔖</span>
          <span className="text-sm font-semibold">{isRtl ? 'بدون تصنيف' : 'No folder'}</span>
        </button>
        {folders.length > 0 && (
          <div className="flex flex-col gap-2 mb-4 max-h-48 overflow-y-auto">
            {folders.map(f => (
              <button key={f.id} onClick={() => onSave(f.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition text-start" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
                <span className="text-lg">📁</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--tr-text-primary)' }}>{f.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{f._count.bookmarks} {isRtl ? 'علامة' : 'marks'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        <form onSubmit={onCreate} className="flex gap-2 mt-3">
          <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder={isRtl ? 'تصنيف جديد...' : 'New folder...'} maxLength={40} className="flex-1 rounded-full px-4 py-2 text-sm outline-none transition" style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }} />
          <button type="submit" disabled={!newFolderName.trim() || creatingFolder} className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-40 transition shrink-0" style={{ background: 'linear-gradient(135deg,var(--tr-gold-dim),var(--tr-gold-bright))', color: '#fff' }}>
            {creatingFolder ? '...' : (isRtl ? 'إنشاء' : 'Create')}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Share dropdown ─────────────────────────────────────────────────── */
function ShareDropdown({ postId, title, content, onCopy, onClose, isRtl }: {
  postId: string; title?: string | null; content: string;
  onCopy: (e: React.MouseEvent) => void; onClose: () => void; isRtl: boolean;
}) {
  const postUrl = typeof window !== 'undefined' ? `${window.location.origin}/tareeq/${postId}` : `/tareeq/${postId}`;
  const text    = encodeURIComponent(title || content.slice(0, 80));
  const url     = encodeURIComponent(postUrl);
  const items   = [
    { label: 'WhatsApp',   color: '#25D366', href: `https://api.whatsapp.com/send?text=${text}%20${url}` },
    { label: 'Twitter / X', color: '#000',  href: `https://twitter.com/intent/tweet?text=${text}&url=${url}` },
    { label: 'Telegram',   color: '#4aaed9', href: `https://t.me/share/url?url=${url}&text=${text}` },
    { label: 'Facebook',   color: '#4c8ef0', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
  ];
  return (
    <div className="absolute bottom-full end-0 mb-2 py-1.5 w-36 z-30 rounded-2xl" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 8px 28px rgba(0,0,0,0.14)' }}>
      {items.map(item => (
        <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" onClick={e => { e.stopPropagation(); onClose(); }} className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-semibold hover:opacity-70 transition" style={{ color: 'var(--tr-text-secondary)' }}>
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
