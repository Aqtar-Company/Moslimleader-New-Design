'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS, CATEGORY_ACCENT_HEX } from '@/lib/tareeq-constants';
import { savePostOffline, removePostOffline, isPostSavedOffline } from '@/lib/tareeq-idb';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import { timeAgo } from '@/lib/tareeq-utils';
import TareeqLoginGate from './TareeqLoginGate';
import TareeqMentionInput from './TareeqMentionInput';

function extractYouTubeId(text: string): string | null {
  const m = text.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function extractTikTokId(text: string): string | null {
  const m = text.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return m ? m[1] : null;
}

function extractVimeoId(text: string): string | null {
  const m = text.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function extractFacebookVideoUrl(text: string): string | null {
  const m = text.match(/https?:\/\/(?:www\.|m\.)?(?:facebook\.com\/(?:[^/]+\/videos\/|watch\/?\?v=|video\.php\?v=)|fb\.watch\/)[^\s<>"'؀-ۿ]+/);
  return m ? m[0].split('?')[0] + (m[0].includes('?v=') ? '?' + m[0].split('?')[1] : '') : null;
}

const VIDEO_PLATFORMS_RE = /youtu\.?be|tiktok\.com|vimeo\.com|facebook\.com\/.*video|fb\.watch/;

function extractFirstNonVideoUrl(text: string): string | null {
  const matches = text.match(/https?:\/\/[^\s<>"'؀-ۿ]{8,}/g);
  if (!matches) return null;
  return matches.find(u => !VIDEO_PLATFORMS_RE.test(u)) ?? null;
}

function renderRichText(text: string): React.ReactNode {
  const regex = /(\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|#[\w؀-ۿݐ-ݿ]{2,}|https?:\/\/[^\s<>"']+)/g;
  const segments: React.ReactNode[] = [];
  let last = 0; let key = 0; let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) segments.push(text.slice(last, match.index));
    const m = match[0];
    if (m.startsWith('**')) {
      segments.push(<strong key={key++} style={{ fontWeight: 700, color: 'inherit' }}>{match[2]}</strong>);
    } else if (m.startsWith('*')) {
      segments.push(<em key={key++}>{match[3]}</em>);
    } else if (m.startsWith('#')) {
      segments.push(<span key={key++} style={{ color: 'var(--tr-gold)', fontWeight: 600 }}>{m}</span>);
    } else {
      segments.push(<span key={key++} style={{ color: 'var(--tr-teal)', wordBreak: 'break-all' }}>{m}</span>);
    }
    last = match.index + m.length;
  }
  if (last < text.length) segments.push(text.slice(last));
  return segments.length ? segments : text;
}

interface LinkPreviewData { title: string | null; description: string | null; image: string | null; domain: string; url: string }

function LinkPreviewCard({ url, isRtl }: { url: string; isRtl: boolean }) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/tareeq/link-preview?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => { if (d.domain) setPreview(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) return (
    <div style={{ height: 60, borderRadius: 10, background: 'var(--tr-raised)', border: '1px solid var(--tr-border-subtle)', marginTop: 8, opacity: 0.5 }} />
  );
  if (!preview?.title) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 10, marginTop: 8, border: '1px solid var(--tr-border-soft)', background: 'var(--tr-raised)', textDecoration: 'none' }}>
      {preview.image && (
        <img src={preview.image} alt="" style={{ width: 56, height: 56, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <div style={{ flex: 1, minWidth: 0, textAlign: isRtl ? 'right' : 'left' }}>
        <p style={{ fontSize: 11, color: 'var(--tr-text-muted)', marginBottom: 2 }}>{preview.domain}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tr-text-primary)', lineHeight: 1.3, display: '-webkit-box', WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: 2, overflow: 'hidden' }}>{preview.title}</p>
        {preview.description && (
          <p style={{ fontSize: 11, color: 'var(--tr-text-secondary)', marginTop: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: 1, overflow: 'hidden' }}>{preview.description}</p>
        )}
      </div>
    </a>
  );
}

import { useSatisfactionCounter } from './TareeqSatisfactionMode';

export interface TareeqPostSummary {
  id: string;
  title?: string | null;
  summary?: string | null;
  content: string;
  category?: string | null;
  tags?: string[] | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  videoUrl?: string | null;
  authorName: string;
  likeCount: number;
  commentCount: number;
  savedCount?: number;
  createdAt: string;
  userId?: string | null;
  user?: { id: string; name: string; avatarUrl?: string | null; role?: string | null } | null;
  postUpdate?: string | null;
  postUpdateAt?: string | null;
  seriesId?: string | null;
  seriesTitle?: string | null;
  seriesOrder?: number | null;
  pinnedCommentId?: string | null;
  topReactions?: string[] | null;
}

interface Props {
  post: TareeqPostSummary;
  initialLiked?: boolean;
  initialReaction?: string | null;
  initialBookmarked?: boolean;
  onMobileOpen?: (postId: string, focusComments?: boolean) => void;
  onDeleted?: (postId: string) => void;
}

const REACTIONS = [
  { type: 'inspired',    emoji: '⭐', labelAr: 'ألهمني',      labelEn: 'Inspiring',  color: '#f59e0b' },
  { type: 'thanks',      emoji: '🙏', labelAr: 'شكرًا',       labelEn: 'Thanks',     color: '#10b981' },
  { type: 'agree',       emoji: '✊', labelAr: 'أتفق',        labelEn: 'Agree',      color: '#3b82f6' },
  { type: 'yarabb',      emoji: '🤲', labelAr: 'يارب',        labelEn: 'Ameen',      color: '#8b5cf6' },
  { type: 'mashaallah',  emoji: '🌴', labelAr: 'ماشاء الله',  labelEn: 'MashaAllah', color: '#16a34a' },
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
              <span style={{ fontSize: 11, fontWeight: 700, color: active ? r.color : (dark ? 'rgba(255,255,255,0.6)' : 'var(--tr-text-muted)') }}>
                {isRtl ? r.labelAr : r.labelEn}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function TareeqCard({ post, initialLiked = false, initialReaction = null, initialBookmarked = false, onMobileOpen, onDeleted }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { trackPost } = useSatisfactionCounter();

  function handlePostLinkClick(e: React.MouseEvent, focusComments = false) {
    if (onMobileOpen) {
      e.preventDefault();
      onMobileOpen(post.id, focusComments);
    }
  }

  // Track this post for the daily satisfaction counter
  useEffect(() => { trackPost(post.id); }, [post.id, trackPost]);

  const isOfficial = post.user?.role === 'admin' || post.user?.role === 'staff';
  const startReaction: string | null = initialReaction ?? (initialLiked ? 'inspired' : null);

  const [currentReaction, setCurrentReaction] = useState<string | null>(startReaction);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [savedCount, setSavedCount] = useState(post.savedCount ?? 0);
  const [showGate, setShowGate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showReactors, setShowReactors] = useState(false);
  const [textExpanded, setTextExpanded] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [showBookmarkPicker, setShowBookmarkPicker] = useState(false);
  const [bmFolders, setBmFolders] = useState<{ id: string; name: string; _count: { bookmarks: number } }[]>([]);
  const [bmFoldersLoaded, setBmFoldersLoaded] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [inlineComments, setInlineComments] = useState<Array<{ id: string; content: string; createdAt: string; userId: string | null; user: { id: string; name: string } | null; replyCount?: number; parentId?: string | null }>>([]);
  const [inlineCommentsLoading, setInlineCommentsLoading] = useState(false);
  const [inlineLoaded, setInlineLoaded] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [showRepliesFor, setShowRepliesFor] = useState<Set<string>>(new Set());
  const [repliesMap, setRepliesMap] = useState<Record<string, Array<{ id: string; content: string; createdAt: string; userId: string | null; user: { id: string; name: string } | null }>>>({});
  const [repliesLoading, setRepliesLoading] = useState<Record<string, boolean>>({});
  const [showDMPicker, setShowDMPicker] = useState(false);
  const [dmConversations, setDMConversations] = useState<{ id: string; otherUser: { id: string; name: string; avatarUrl?: string | null } }[]>([]);
  const [dmSending, setDMSending] = useState<string | null>(null);
  const [dmSent, setDMSent] = useState<string | null>(null);
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

  // Check if post is pinned offline on mount
  useEffect(() => {
    isPostSavedOffline(post.id).then(setIsSavedOffline).catch(() => {});
  }, [post.id]);

  async function handleOfflineToggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (isSavedOffline) {
      setIsSavedOffline(false);
      await removePostOffline(post.id).catch(() => {});
    } else {
      setIsSavedOffline(true);
      await savePostOffline({
        id: post.id,
        title: post.title ?? null,
        content: post.content,
        imageUrl: post.imageUrl ?? null,
        imageUrls: Array.isArray(post.imageUrls) ? (post.imageUrls as string[]) : null,
        authorName: post.authorName,
        category: post.category ?? null,
        createdAt: post.createdAt,
      }).catch(() => setIsSavedOffline(false));
    }
  }

  const catKey    = post.category as TareeqCategoryKey | null;
  const catLabel  = catKey && TAREEQ_CATEGORIES[catKey] ? (isRtl ? TAREEQ_CATEGORIES[catKey].ar : TAREEQ_CATEGORIES[catKey].en) : post.category;
  const catIcon   = catKey ? (CATEGORY_ICONS[catKey] ?? '') : '';
  const accentHex = catKey ? (CATEGORY_ACCENT_HEX[catKey] ?? '#ff5c38') : '#ff5c38';
  const snippet   = post.summary || post.content.slice(0, 200);
  // Safe cast from Prisma JsonValue (string[] at runtime, but typed loosely)
  const parsedImageUrls: string[] | null = Array.isArray(post.imageUrls)
    ? (post.imageUrls as unknown[]).filter((u): u is string => typeof u === 'string')
    : null;
  // allImages: prefer parsedImageUrls when present, fallback to imageUrl
  const allImages: string[] = (parsedImageUrls && parsedImageUrls.length >= 1)
    ? parsedImageUrls
    : post.imageUrl ? [post.imageUrl] : [];
  const hasImage  = allImages.length > 0;
  const isGallery = allImages.length >= 2;

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
    setShowShareMenu(v => !v);
  }

  async function handleNativeShare(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const url = `${window.location.origin}/tareeq/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title || (isRtl ? 'علامة على طريق' : 'A mark on Tareeq'), text: post.content.slice(0, 100), url }); }
      catch { /* cancelled */ }
    }
  }

  async function handleOpenDMPicker() {
    if (!user) return;
    setShowDMPicker(true);
    setDMSent(null);
    try {
      const res = await fetch('/api/tareeq/conversations', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setDMConversations(d.conversations ?? []); }
    } catch { /* offline */ }
  }

  async function handleSendToDM(convId: string) {
    if (dmSending) return;
    setDMSending(convId);
    try {
      await fetch(`/api/tareeq/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: '',
          sharedPostId: post.id,
          sharedPostTitle: post.title ?? null,
          sharedPostImageUrl: post.imageUrl ?? null,
        }),
      });
      setDMSent(convId);
    } catch { /* ignore */ }
    finally { setDMSending(null); }
  }

  function handleCommentToggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { setShowGate(true); return; }
    const next = !showCommentInput;
    setShowCommentInput(next);
    if (next) {
      setTimeout(() => commentInputRef.current?.focus(), 30);
      if (!inlineLoaded) {
        setInlineLoaded(true);
        setInlineCommentsLoading(true);
        fetch(`/api/tareeq/${post.id}/comments`)
          .then(r => r.json())
          .then(d => setInlineComments(d.comments ?? []))
          .catch(() => {})
          .finally(() => setInlineCommentsLoading(false));
      }
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user || commentText.trim().length < 2) return;
    setCommentError(null);
    setSubmitting(true);
    const parentId = replyingTo?.id ?? null;
    try {
      const res = await fetch(`/api/tareeq/${post.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ content: commentText.trim(), ...(parentId ? { parentId } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCommentText('');
        if (parentId) {
          // Add reply to repliesMap and increment parent replyCount
          if (data.comment) {
            setRepliesMap(prev => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), data.comment] }));
            setShowRepliesFor(prev => new Set([...prev, parentId]));
          }
          setInlineComments(prev => prev.map(c => c.id === parentId ? { ...c, replyCount: (c.replyCount ?? 0) + 1 } : c));
          setReplyingTo(null);
        } else {
          setCommentCount(c => c + 1);
          if (data.comment) setInlineComments(prev => [...prev, data.comment]);
        }
      } else {
        setCommentError(data.error ?? (isRtl ? 'حدث خطأ، حاول مرة أخرى' : 'Error, please try again'));
      }
    } catch { setCommentError(isRtl ? 'تحقق من اتصالك بالإنترنت' : 'Check your internet connection'); } finally {
      setSubmitting(false);
    }
  }

  async function loadReplies(commentId: string) {
    if (repliesLoading[commentId]) return;
    setRepliesLoading(prev => ({ ...prev, [commentId]: true }));
    try {
      const res = await fetch(`/api/tareeq/${post.id}/comments?parentId=${commentId}`);
      if (res.ok) {
        const d = await res.json();
        setRepliesMap(prev => ({ ...prev, [commentId]: d.comments ?? [] }));
      }
    } catch { /* ignore */ }
    finally { setRepliesLoading(prev => ({ ...prev, [commentId]: false })); }
  }

  async function handleBookmarkClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { setShowGate(true); return; }
    if (isBookmarked) {
      setIsBookmarked(false);
      setSavedCount(c => Math.max(0, c - 1));
      const res = await fetch(`/api/tareeq/bookmarks?postId=${post.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
      if (!res?.ok) { setIsBookmarked(true); setSavedCount(c => c + 1); }
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
    setSavedCount(c => c + 1);
    const res = await fetch('/api/tareeq/bookmarks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ postId: post.id, folderId }),
    });
    if (!res.ok) { setIsBookmarked(false); setSavedCount(c => Math.max(0, c - 1)); }
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim() || creatingFolder) return;
    setCreatingFolder(true);
    const res = await fetch('/api/tareeq/bookmark-folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    if (res.ok) { const d = await res.json(); setBmFolders(prev => [...prev, { ...d.folder, _count: { bookmarks: 0 } }]); setNewFolderName(''); }
    setCreatingFolder(false);
  }

  /* ── Shared inline comments + form ──────────────────────────────── */
  const commentForm = showCommentInput ? (
    <div onClick={e => e.stopPropagation()}>
      {/* Inline comments list */}
      {inlineCommentsLoading ? (
        <div className="px-4 pt-3 pb-1 text-center text-xs" style={{ color: 'var(--tr-text-muted)' }}>...</div>
      ) : inlineComments.length > 0 ? (
        <div className="px-4 pt-2 pb-0 flex flex-col gap-0" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
          {inlineComments.map(c => (
            <div key={c.id}>
              <div className="flex gap-2.5 py-2" style={{ borderBottom: (c.replyCount ?? 0) > 0 || showRepliesFor.has(c.id) ? 'none' : '1px solid var(--tr-border-subtle)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold-dim, rgba(212,168,83,0.3))' }}>
                  {(c.user?.name ?? '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--tr-text-primary)' }}>{c.user?.name ?? '—'}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--tr-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</p>
                  <button
                    className="text-[11px] font-semibold mt-1"
                    style={{ color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', margin: '-4px -8px' }}
                    onClick={() => { setReplyingTo({ id: c.id, name: c.user?.name ?? '' }); setTimeout(() => commentInputRef.current?.focus(), 30); }}
                  >
                    {isRtl ? 'رد' : 'Reply'}
                  </button>
                </div>
              </div>
              {/* Replies */}
              {(c.replyCount ?? 0) > 0 && (
                <div className="ps-9 pb-1" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
                  {!showRepliesFor.has(c.id) ? (
                    <button
                      className="text-[11px] font-semibold mb-1"
                      style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => {
                        setShowRepliesFor(prev => new Set([...prev, c.id]));
                        if (!repliesMap[c.id]) loadReplies(c.id);
                      }}
                    >
                      {repliesLoading[c.id] ? '...' : (isRtl ? `الردود (${c.replyCount})` : `Replies (${c.replyCount})`)}
                    </button>
                  ) : (
                    <>
                      {repliesLoading[c.id] ? (
                        <div className="text-[11px] py-1" style={{ color: 'var(--tr-text-muted)' }}>...</div>
                      ) : (repliesMap[c.id] ?? []).map(r => (
                        <div key={r.id} className="flex gap-2 py-1.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)' }}>
                            {(r.user?.name ?? '?').charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--tr-text-primary)' }}>{r.user?.name ?? '—'}</p>
                            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tr-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.content}</p>
                          </div>
                        </div>
                      ))}
                      <button
                        className="text-[11px] font-semibold mb-1"
                        style={{ color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={() => setShowRepliesFor(prev => { const s = new Set(prev); s.delete(c.id); return s; })}
                      >
                        {isRtl ? 'إخفاء الردود' : 'Hide replies'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {/* Comment input */}
      <div style={{ borderTop: inlineComments.length === 0 ? '1px solid var(--tr-border-subtle)' : 'none' }}>
        {commentError && (
          <p className="px-4 pt-2 text-xs font-semibold" style={{ color: '#ef4444' }}>{commentError}</p>
        )}
        {/* Reply indicator */}
        {replyingTo && (
          <div className="px-4 pt-2 flex items-center gap-2">
            <span className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? `رد على ${replyingTo.name}` : `Replying to ${replyingTo.name}`}
            </span>
            <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tr-text-muted)', fontSize: 12, lineHeight: 1 }}>✕</button>
          </div>
        )}
        <form onSubmit={handleComment} className="px-4 pb-3 pt-2.5 flex gap-2 items-center">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold-dim, rgba(212,168,83,0.3))' }}>
            {user?.name?.charAt(0) ?? '?'}
          </div>
          <TareeqMentionInput
            inputRef={commentInputRef}
            value={commentText}
            onValueChange={v => { setCommentText(v); if (commentError) setCommentError(null); }}
            onKeyDown={e => { if (e.key === 'Escape') { if (replyingTo) setReplyingTo(null); else setShowCommentInput(false); } }}
            placeholder={replyingTo ? (isRtl ? `رد على ${replyingTo.name}...` : `Reply to ${replyingTo.name}...`) : (isRtl ? 'أضف تعليقاً...' : 'Add a comment...')}
            maxLength={500}
            className="rounded-full px-3 py-1.5 text-sm outline-none transition"
            style={{ background: 'var(--tr-raised)', border: `1px solid ${replyingTo ? '#3b82f6' : 'var(--tr-border-soft)'}`, color: 'var(--tr-text-primary)' }}
            isRtl={isRtl}
          />
          <button type="submit" disabled={submitting || commentText.trim().length < 2} className="px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-40 transition shrink-0 text-white" style={{ background: 'var(--tr-gold)' }}>
            {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
          </button>
        </form>
      </div>
    </div>
  ) : null;

  /* ── Desktop action bar (labeled buttons) ───────────────────────── */
  function DesktopActionBar() {
    const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, transition: 'background 150ms', background: 'transparent', border: 'none', cursor: 'pointer' };
    const hover = { background: 'var(--tr-overlay)' };
    return (
      <>
        <style>{'.tr-action-btn:focus-visible{outline:2px solid var(--tr-gold);outline-offset:2px;border-radius:8px} @keyframes tr-copy-pop{0%{transform:scale(1)}50%{transform:scale(1.22)}100%{transform:scale(1)}}'}</style>
        <div className="px-2 py-1 flex items-center gap-0.5" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>

        {/* React */}
        <div className="relative">
          <button
            onClick={handleReactionAreaClick}
            className="tr-action-btn"
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
          className="tr-action-btn"
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
            className="tr-action-btn"
            style={{ ...btnBase, color: copied ? 'var(--tr-gold)' : 'var(--tr-text-secondary)' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, hover)}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <span style={copied ? { animation: 'tr-copy-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)' } : undefined}>
              <IconShare size={17} check={copied} />
            </span>
            <span>{isRtl ? 'مشاركة' : 'Share'}</span>
          </button>
          {showShareMenu && <ShareDropdown postId={post.id} title={post.title} content={post.content} onCopy={handleCopyLink} onClose={() => setShowShareMenu(false)} onSendDM={user ? handleOpenDMPicker : undefined} onNativeShare={handleNativeShare} isRtl={isRtl} />}
        </div>

        {/* Options — own posts: delete; others: report/unfollow */}
        {user && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setShowOptions(true); }}
            aria-label={isRtl ? 'خيارات' : 'Options'}
            className="tr-action-btn"
            style={{ ...btnBase, color: 'var(--tr-text-muted)', padding: '8px 10px', gap: 5 }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, hover)}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <svg width={15} height={15} fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
        )}

        {/* Bookmark */}
        <button
          onClick={handleBookmarkClick}
          aria-label={isRtl ? 'حفظ' : 'Save'}
          className="tr-action-btn"
          style={{ ...btnBase, color: isBookmarked ? 'var(--tr-gold)' : 'var(--tr-text-muted)', padding: '8px 10px' }}
          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, hover)}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <IconBookmark filled={isBookmarked} size={17} />
        </button>

        {/* Offline pin */}
        <button
          onClick={handleOfflineToggle}
          aria-label={isRtl ? (isSavedOffline ? 'إزالة من الحفظ بدون إنترنت' : 'حفظ للقراءة بدون إنترنت') : (isSavedOffline ? 'Remove offline' : 'Save offline')}
          title={isRtl ? (isSavedOffline ? 'إزالة من الحفظ بدون إنترنت' : 'حفظ للقراءة بدون إنترنت') : (isSavedOffline ? 'Remove offline' : 'Save offline')}
          className="tr-action-btn"
          style={{ ...btnBase, color: isSavedOffline ? 'var(--tr-gold)' : 'var(--tr-text-muted)', padding: '8px 10px' }}
          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, hover)}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {/* Download-to-device icon */}
          <svg width={17} height={17} fill="none" stroke="currentColor" strokeWidth={isSavedOffline ? 2.2 : 1.8} viewBox="0 0 24 24">
            {isSavedOffline
              ? <><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></>
              : <><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></>}
          </svg>
        </button>
      </div>
      </>
    );
  }

  /* ── Social summary row ─────────────────────────────────────────── */
  function SocialSummary() {
    if (likeCount <= 0 && commentCount <= 0) return null;

    // Build emoji list: use topReactions from API (actual reaction types used),
    // or fallback to current user's reaction, or generic star
    const topEmojis: string[] = (() => {
      const tr = post.topReactions;
      if (tr && tr.length > 0) return tr.slice(0, 3).map(t => reactionEmoji(t));
      if (currentReaction) return [reactionEmoji(currentReaction)];
      return ['⭐'];
    })();

    return (
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
        {likeCount > 0 && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setShowReactors(true); }}
            className="flex items-center gap-1.5 transition"
            style={{ color: 'var(--tr-text-secondary)' }}
          >
            {/* Stacked reaction emoji circles — Facebook style */}
            <span className="flex items-center" style={{ direction: 'ltr' }}>
              {topEmojis.map((em, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20, borderRadius: '50%',
                    fontSize: 13, lineHeight: 1,
                    border: '2px solid var(--tr-base)',
                    marginInlineStart: i > 0 ? -7 : 0,
                    background: 'var(--tr-raised)',
                    zIndex: topEmojis.length - i,
                    position: 'relative',
                  }}
                >
                  {em}
                </span>
              ))}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(likeCount)}</span>
          </button>
        )}
        {commentCount > 0 && (
          <button
            onClick={handleCommentToggle}
            className="flex items-center gap-1 transition hover:underline ms-auto"
            style={{ color: 'var(--tr-text-secondary)', fontSize: 12 }}
          >
            <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
            </svg>
            <span>{fmt(commentCount)}</span>
          </button>
        )}
      </div>
    );
  }

  /* ── MULTI-IMAGE GALLERY CARD ──────────────────────────────────── */
  if (isGallery) {
    const shown = allImages.slice(0, 4);
    const extra = allImages.length - 4;
    const totalCount = allImages.length;

    function GalleryGrid() {
      const count = shown.length;
      if (count === 2) {
        return (
          <div className="grid grid-cols-2 gap-1">
            {shown.map((url, i) => (
              <div key={i} className="relative aspect-square overflow-hidden">
                <img src={url} alt="" className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        );
      }
      if (count === 3) {
        // Left cell spans 2 rows; right column has 2 equal cells.
        // Use explicit row height so all browsers agree.
        return (
          <div className="grid grid-cols-2 gap-1" style={{ gridTemplateRows: '120px 120px' }}>
            <div className="relative overflow-hidden" style={{ gridRow: 'span 2' }}>
              <img src={shown[0]} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" referrerPolicy="no-referrer" />
            </div>
            {shown.slice(1).map((url, i) => (
              <div key={i} className="relative overflow-hidden">
                <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        );
      }
      // 4 images (2×2)
      return (
        <div className="grid grid-cols-2 gap-1">
          {shown.map((url, i) => (
            <div key={i} className="relative aspect-square overflow-hidden">
              <img src={url} alt="" className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" />
              {i === 3 && extra > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: 'rgba(0,0,0,0.62)' }}>
                  <span className="text-white font-black text-2xl leading-none">+{extra}</span>
                  <span className="text-white/80 text-[11px] font-semibold">{isRtl ? 'عرض الكل' : 'View all'}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <>
        <article
          className="relative rounded-[24px] lg:rounded-[14px]"
          style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          aria-label={post.title || post.content.slice(0, 80)}
        >
          {/* Gallery grid — links to post */}
          <Link href={`/tareeq/${post.id}`} className="block overflow-hidden relative" onClick={handlePostLinkClick}>
            {/* Category badge — frosted on mobile (readable over any image), light on desktop */}
            {catLabel && (
              <div className="absolute top-3 start-3 z-10 pointer-events-none">
                <span className="lg:hidden text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', border: `1px solid ${accentHex}70` }}>
                  {catIcon} {catLabel}
                </span>
                <span className="hidden lg:inline text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: accentHex, background: 'rgba(255,255,255,0.95)', border: `1px solid ${accentHex}35` }}>
                  {catIcon} {catLabel}
                </span>
              </div>
            )}
            {/* Image count pill — top-end corner */}
            <div className="absolute top-3 end-3 z-10 pointer-events-none">
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)' }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/>
                </svg>
                {totalCount}
              </span>
            </div>
            <GalleryGrid />
          </Link>

          {/* Author + caption strip */}
          <div className="px-4 pt-3.5 pb-2">
            <div className="flex items-center gap-2.5 mb-2">
              {post.userId
                ? <Link href={`/tareeq/u/${post.userId}`} onClick={e => e.stopPropagation()} className="shrink-0">
                    {post.user?.avatarUrl
                      ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-8 h-8 rounded-full object-cover" style={{ border: '2px solid var(--tr-gold)' }} />
                      : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}>{post.authorName.charAt(0)}</div>
                    }
                  </Link>
                : (post.user?.avatarUrl
                    ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border: '2px solid var(--tr-gold)' }} />
                    : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}>{post.authorName.charAt(0)}</div>
                  )
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  {post.userId
                    ? <Link href={`/tareeq/u/${post.userId}`} onClick={e => e.stopPropagation()} className="text-sm font-semibold truncate hover:underline" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</Link>
                    : <p className="text-sm font-semibold truncate" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</p>
                  }
                  {isOfficial && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0" style={{ background: 'rgba(59,130,246,0.13)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.28)' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.491 4.491 0 01-3.497-1.307 4.491 4.491 0 01-1.307-3.497A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd"/></svg>
                      {isRtl ? 'رسمي' : 'Official'}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(post.createdAt, isRtl)}</p>
              </div>
            </div>
            {(post.title || snippet) && (
              <Link href={`/tareeq/${post.id}`} className="block" onClick={handlePostLinkClick}>
                {post.title && <h3 className="font-extrabold text-sm leading-snug mb-1 hover:underline" style={{ color: 'var(--tr-text-primary)' }}>{post.title}</h3>}
                {snippet && <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--tr-text-secondary)' }}>{snippet}</p>}
              </Link>
            )}
          </div>

          {/* Social summary - all screens */}
          <SocialSummary />

          {/* Desktop action bar */}
          <div className="hidden lg:block">
            <DesktopActionBar />
          </div>

          {/* Mobile: compact action bar — mirrors text card */}
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
              {savedCount > 0 && <span>{fmt(savedCount)}</span>}
            </button>

            <div className="ms-auto flex items-center gap-2">
              <div ref={shareMenuRef} className="relative">
                <button onClick={handleShare} className="flex items-center gap-1 text-xs font-semibold transition" style={{ color: copied ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
                  <IconShare size={16} check={copied} />
                </button>
                {showShareMenu && <ShareDropdown postId={post.id} title={post.title} content={post.content} onCopy={handleCopyLink} onClose={() => setShowShareMenu(false)} onSendDM={user ? handleOpenDMPicker : undefined} onNativeShare={handleNativeShare} isRtl={isRtl} />}
              </div>
              {user && (
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowOptions(true); }} aria-label={isRtl ? 'خيارات' : 'Options'} className="flex items-center gap-1 text-xs font-semibold transition active:scale-90" style={{ color: 'var(--tr-text-muted)' }}>
                  <svg width={16} height={16} fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                </button>
              )}
            </div>
          </div>

          {commentForm}
        </article>

        {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
        {showBookmarkPicker && <BookmarkPicker isRtl={isRtl} folders={bmFolders} newFolderName={newFolderName} setNewFolderName={setNewFolderName} creatingFolder={creatingFolder} onSave={handleBookmarkSave} onCreate={handleCreateFolder} onClose={() => setShowBookmarkPicker(false)} />}
        {showOptions && <OptionsSheet isRtl={isRtl} postId={post.id} postUserId={post.userId ?? ''} isOwn={user?.id === post.userId} onReport={() => setShowReport(true)} onDeleted={() => { setShowOptions(false); onDeleted?.(post.id); }} onClose={() => setShowOptions(false)} />}
        {showReport && <ReportModal targetType="post" targetId={post.id} isRtl={isRtl} onClose={() => setShowReport(false)} />}
        {showReactors && <ReactorsModal postId={post.id} isRtl={isRtl} onClose={() => setShowReactors(false)} />}
        {showDMPicker && <DMPickerModal conversations={dmConversations} dmSending={dmSending} dmSent={dmSent} onSend={handleSendToDM} onClose={() => { setShowDMPicker(false); setDMSent(null); }} isRtl={isRtl} />}
      </>
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
            {/* Inner clip — keeps image + overlays within bounds without clipping side icons */}
            <div className="absolute inset-0 overflow-hidden">
              {/* Blurred letterbox bg — same image blurred + dimmed to fill empty space */}
              <img src={post.imageUrl!} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 pointer-events-none select-none" style={{ filter: 'blur(18px) brightness(0.45)' }} />
              <Link href={`/tareeq/${post.id}`} className="relative block w-full h-full" onClick={handlePostLinkClick}>
                <img src={post.imageUrl!} alt="" className="w-full h-full object-contain" loading="eager" referrerPolicy="no-referrer" />
                {/* Mobile gradient — bottom-heavy overlay */}
                <div className="absolute inset-0 lg:hidden" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.05) 70%, transparent 100%)' }} />
                {/* Desktop gradient — subtle top-to-bottom */}
                <div className="absolute inset-0 hidden lg:block" style={{ background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.10) 100%)', pointerEvents: 'none' }} />
              </Link>

              {/* Category badge — mobile: left side (end-4), desktop: left side (start-4) */}
              {catLabel && (
                <div className="absolute top-4 end-4 lg:start-4 lg:end-auto z-10 pointer-events-none">
                  <span className="lg:hidden text-[11px] font-bold px-3 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', border: `1px solid ${accentHex}70` }}>
                    {catIcon} {catLabel}
                  </span>
                  <span className="hidden lg:inline text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: accentHex, background: 'rgba(255,255,255,0.95)', border: `1px solid ${accentHex}35` }}>
                    {catIcon} {catLabel}
                  </span>
                </div>
              )}

              {/* ── MOBILE ONLY: bottom text overlay (no author — moved to right column) ── */}
              {(post.title || snippet) && (
                <div className="absolute bottom-0 inset-x-0 z-10 px-4 pb-4 pt-2 pointer-events-none lg:hidden">
                  <p className="text-white/90 text-xs leading-relaxed line-clamp-2" style={{ paddingRight: 72 }}>
                    {post.title ? <strong>{post.title} — </strong> : null}{snippet}
                  </p>
                </div>
              )}

              {/* ── MOBILE ONLY: comment input overlay ── */}
              {showCommentInput && (
                <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4 pt-3 lg:hidden" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}>
                  {commentError && (
                    <p className="text-[11px] font-semibold mb-1.5" style={{ color: '#fca5a5' }}>{commentError}</p>
                  )}
                  <form onSubmit={handleComment} onClick={e => e.stopPropagation()} className="flex gap-2 items-center">
                    <input ref={commentInputRef} value={commentText} onChange={e => { setCommentText(e.target.value); if (commentError) setCommentError(null); }} onKeyDown={e => { if (e.key === 'Escape') setShowCommentInput(false); }} placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'} maxLength={500} className="flex-1 rounded-full px-4 py-2 text-xs text-white outline-none" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }} />
                    <button type="submit" disabled={submitting || commentText.trim().length < 2} className="px-4 py-2 rounded-full text-xs font-bold text-white disabled:opacity-40 transition shrink-0" style={{ background: 'var(--tr-gold)' }}>
                      {submitting ? '...' : (isRtl ? 'إرسال' : 'Send')}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* ── MOBILE ONLY: right column — author at top, then action buttons ── */}
            <div className="absolute right-3 top-3 z-10 flex flex-col items-center gap-3 lg:hidden">

              {/* Author */}
              <Link href={post.userId ? `/tareeq/u/${post.userId}` : '#'} onClick={e => e.stopPropagation()} className="flex flex-col items-center gap-0.5">
                {post.user?.avatarUrl
                  ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-10 h-10 rounded-full object-cover shrink-0" style={{ border: '2px solid rgba(255,255,255,0.5)' }} />
                  : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '2px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)' }}>{post.authorName.charAt(0)}</div>
                }
                <p className="text-white text-[9px] font-bold text-center leading-tight mt-0.5" style={{ maxWidth: 52, textShadow: '0 1px 3px rgba(0,0,0,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.authorName}</p>
                <p className="text-white/60 text-[10px] text-center" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)', opacity: 0.72 }}>{timeAgo(post.createdAt, isRtl)}</p>
              </Link>

              {/* Reaction */}
              <div className="relative flex flex-col items-center gap-1">
                <button onClick={handleReactionAreaClick} aria-label={isRtl ? 'تفاعل' : 'React'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: currentReaction ? `${reactionConfig?.color ?? '#f59e0b'}30` : 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)', border: currentReaction ? `1.5px solid ${reactionConfig?.color ?? '#f59e0b'}80` : '1.5px solid rgba(255,255,255,0.25)', fontSize: currentReaction ? 22 : 18 }}>
                    {currentReaction ? reactionEmoji(currentReaction) : <svg width={20} height={20} viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)"><path d="M12 3l1.2 4.8L18 6.8l-3.6 3.6 1.2 5.4-3.6-2.4-3.6 2.4 1.2-5.4L6 6.8l4.8 1.2z" /></svg>}
                  </div>
                  <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{fmt(likeCount)}</span>
                </button>
                {showPicker && (
                  <div style={{ position: 'absolute', right: 'calc(100% + 10px)', top: 0, zIndex: 20 }} onClick={e => e.stopPropagation()}>
                    <ReactionPicker currentReaction={currentReaction} onReact={(t) => handleReact(t)} onClose={() => setShowPicker(false)} isRtl={isRtl} dark />
                  </div>
                )}
              </div>

              {/* Share */}
              <div ref={shareMenuRef} className="relative flex flex-col items-center gap-1">
                <button onClick={handleShare} aria-label={isRtl ? 'مشاركة' : 'Share'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)' }}>
                    <IconShare size={20} check={copied} />
                  </div>
                  <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{copied ? '✓' : (isRtl ? 'شارك' : 'Share')}</span>
                </button>
                {showShareMenu && <ShareDropdown postId={post.id} title={post.title} content={post.content} onCopy={handleCopyLink} onClose={() => setShowShareMenu(false)} onSendDM={user ? handleOpenDMPicker : undefined} onNativeShare={handleNativeShare} isRtl={isRtl} />}
              </div>

              {/* Comment */}
              <button onClick={handleCommentToggle} aria-label={isRtl ? 'تعليق' : 'Comment'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: showCommentInput ? 'rgba(255,92,56,0.7)' : 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)' }}>
                  <IconComment size={20} />
                </div>
                <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{fmt(commentCount)}</span>
              </button>

              {/* Bookmark */}
              <button onClick={handleBookmarkClick} aria-label={isRtl ? 'حفظ' : 'Save'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                <div className="w-11 h-11 rounded-full flex items-center justify-center transition" style={{ background: isBookmarked ? 'rgba(212,168,83,0.35)' : 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)', border: isBookmarked ? '1.5px solid rgba(212,168,83,0.6)' : 'none', color: isBookmarked ? '#d4a853' : '#fff' }}>
                  <IconBookmark filled={isBookmarked} size={20} />
                </div>
                <span className="text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', color: isBookmarked ? '#d4a853' : '#fff' }}>{savedCount > 0 ? fmt(savedCount) : (isRtl ? 'حفظ' : 'Save')}</span>
              </button>

              {/* Options */}
              {user && (
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowOptions(true); }} aria-label={isRtl ? 'خيارات' : 'Options'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', color: 'rgba(255,255,255,0.85)' }}>
                    <svg width={20} height={20} fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                  </div>
                  <span className="text-[10px] font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.80)' }}>{isRtl ? 'خيارات' : 'More'}</span>
                </button>
              )}
            </div>
          </div>{/* close image container */}

          {/* ── DESKTOP ONLY: author + text ── */}
          <div className="hidden lg:block">
            <div className="px-4 pt-3.5 pb-2">
              <div className="flex items-center gap-2.5 mb-2.5">
                {post.userId
                  ? <Link href={`/tareeq/u/${post.userId}`} onClick={e => e.stopPropagation()} className="shrink-0">
                      {post.user?.avatarUrl
                        ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-9 h-9 rounded-full object-cover" style={{ border: '2px solid var(--tr-gold)' }} />
                        : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}>{post.authorName.charAt(0)}</div>
                      }
                    </Link>
                  : (post.user?.avatarUrl
                      ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-9 h-9 rounded-full object-cover shrink-0" style={{ border: '2px solid var(--tr-gold)' }} />
                      : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}>{post.authorName.charAt(0)}</div>
                    )
                }
                <div className="flex-1 min-w-0">
                  {post.userId
                    ? <Link href={`/tareeq/u/${post.userId}`} onClick={e => e.stopPropagation()} className="text-sm font-semibold truncate block hover:underline" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</Link>
                    : <p className="text-sm font-semibold truncate" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</p>
                  }
                  <p className="text-xs mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(post.createdAt, isRtl)}</p>
                </div>
              </div>
              <Link href={`/tareeq/${post.id}`} className="block" onClick={handlePostLinkClick}>
                {post.title && <h3 className="font-extrabold text-sm leading-snug mb-1.5 hover:underline" style={{ color: 'var(--tr-text-primary)' }}>{post.title}</h3>}
                {snippet && <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--tr-text-secondary)' }}>{snippet}</p>}
              </Link>
            </div>
            <SocialSummary />
            <DesktopActionBar />
            {commentForm}
          </div>

          {/* Social summary - mobile only (desktop version is inside the hidden lg:block above) */}
          <div className="lg:hidden">
            <SocialSummary />
          </div>
        </article>

        {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
        {showBookmarkPicker && <BookmarkPicker isRtl={isRtl} folders={bmFolders} newFolderName={newFolderName} setNewFolderName={setNewFolderName} creatingFolder={creatingFolder} onSave={handleBookmarkSave} onCreate={handleCreateFolder} onClose={() => setShowBookmarkPicker(false)} />}
        {showOptions && <OptionsSheet isRtl={isRtl} postId={post.id} postUserId={post.userId ?? ''} isOwn={user?.id === post.userId} onReport={() => setShowReport(true)} onDeleted={() => { setShowOptions(false); onDeleted?.(post.id); }} onClose={() => setShowOptions(false)} />}
        {showReport && <ReportModal targetType="post" targetId={post.id} isRtl={isRtl} onClose={() => setShowReport(false)} />}
        {showReactors && <ReactorsModal postId={post.id} isRtl={isRtl} onClose={() => setShowReactors(false)} />}
        {showDMPicker && <DMPickerModal conversations={dmConversations} dmSending={dmSending} dmSent={dmSent} onSend={handleSendToDM} onClose={() => { setShowDMPicker(false); setDMSent(null); }} isRtl={isRtl} />}
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

        {/* Author row — outside post link to avoid nested <a> tags */}
        <div className="px-4 pt-5 pb-0">
          <div className="flex items-center gap-3 mb-3.5">
            {post.userId
              ? <Link href={`/tareeq/u/${post.userId}`} className="shrink-0" onClick={e => e.stopPropagation()}>
                  {post.user?.avatarUrl
                    ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-11 h-11 rounded-full object-cover" style={{ border: '2px solid var(--tr-gold)' }} />
                    : <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-black" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}>{post.authorName.charAt(0)}</div>
                  }
                </Link>
              : (post.user?.avatarUrl
                  ? <img src={post.user.avatarUrl} alt={post.authorName} className="w-11 h-11 rounded-full object-cover shrink-0" style={{ border: '2px solid var(--tr-gold)' }} />
                  : <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-black shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}>{post.authorName.charAt(0)}</div>
                )
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                {post.userId
                  ? <Link href={`/tareeq/u/${post.userId}`} className="text-[15px] font-semibold truncate hover:underline" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</Link>
                  : <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--tr-text-primary)' }}>{post.authorName}</p>
                }
                {isOfficial && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0" style={{ background: 'rgba(59,130,246,0.13)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.28)' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.491 4.491 0 01-3.497-1.307 4.491 4.491 0 01-1.307-3.497A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd"/></svg>
                    {isRtl ? 'رسمي' : 'Official'}
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(post.createdAt, isRtl)}</p>
            </div>
            {catLabel && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ color: accentHex, background: `${accentHex}14`, border: `1px solid ${accentHex}30` }}>
                {catIcon} {catLabel}
              </span>
            )}
          </div>
        </div>

        {/* Post content — separate link so no nested anchors */}
        <Link href={`/tareeq/${post.id}`} className="block px-4 pb-3.5" onClick={handlePostLinkClick}>
          {post.title && (
            <h3 className="font-extrabold text-[15px] leading-snug mb-2" style={{ color: 'var(--tr-text-primary)' }}>{post.title}</h3>
          )}

          <p
            className="text-[15px] leading-relaxed"
            style={{
              color: 'var(--tr-text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              ...(isLong && !textExpanded ? { display: '-webkit-box', WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: 5, overflow: 'hidden' } : {}),
            }}
          >
            {renderRichText(textExpanded ? post.content : snippet)}
          </p>
          {isLong && !textExpanded && (
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setTextExpanded(true); }} className="text-sm font-bold mt-2 transition flex items-center gap-1" style={{ color: 'var(--tr-gold)' }}>
              {isRtl ? '...المزيد' : 'Read more'}
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d={isRtl ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
              </svg>
            </button>
          )}

          {/* Video embeds — auto-detected from content (YouTube → TikTok → Vimeo → Facebook) — skip if post has its own uploaded video */}
          {!post.videoUrl && (() => {
            const embedStyle: React.CSSProperties = { aspectRatio: '16/9', border: '1px solid var(--tr-border-soft)' };
            const iframeProps = { className: 'w-full h-full', allowFullScreen: true as const, loading: 'lazy' as const, style: { border: 'none', display: 'block' } };

            const ytId = extractYouTubeId(post.content);
            if (ytId) return (
              <div className="mt-3 rounded-2xl overflow-hidden" style={embedStyle} onClick={e => e.stopPropagation()}>
                <iframe src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" {...iframeProps} />
              </div>
            );

            const ttId = extractTikTokId(post.content);
            if (ttId) return (
              <div className="mt-3 rounded-2xl overflow-hidden" style={{ ...embedStyle, aspectRatio: '9/16', maxHeight: 560 }} onClick={e => e.stopPropagation()}>
                <iframe src={`https://www.tiktok.com/embed/v2/${ttId}`} allow="autoplay" {...iframeProps} />
              </div>
            );

            const vimeoId = extractVimeoId(post.content);
            if (vimeoId) return (
              <div className="mt-3 rounded-2xl overflow-hidden" style={embedStyle} onClick={e => e.stopPropagation()}>
                <iframe src={`https://player.vimeo.com/video/${vimeoId}?badge=0&autopause=0`} allow="autoplay; fullscreen; picture-in-picture" {...iframeProps} />
              </div>
            );

            const fbUrl = extractFacebookVideoUrl(post.content);
            if (fbUrl) return (
              <div className="mt-3 rounded-2xl overflow-hidden" style={embedStyle} onClick={e => e.stopPropagation()}>
                <iframe src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(fbUrl)}&width=640&show_text=false&height=360`} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" {...iframeProps} />
              </div>
            );

            return null;
          })()}

          {/* Link preview — shown only when no image/video and no video embed detected */}
          {isTextOnly && !extractYouTubeId(post.content) && !extractTikTokId(post.content) && !extractVimeoId(post.content) && !extractFacebookVideoUrl(post.content) && (() => {
            const firstUrl = extractFirstNonVideoUrl(post.content);
            return firstUrl ? <LinkPreviewCard url={firstUrl} isRtl={isRtl} /> : null;
          })()}

          {post.videoUrl && !hasImage && (
            <div className="mt-3 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--tr-border-soft)' }} onClick={e => e.stopPropagation()}>
              <video
                src={post.videoUrl}
                controls
                preload="metadata"
                playsInline
                style={{ width: '100%', maxHeight: 480, display: 'block', background: '#000', borderRadius: 16 }}
              />
            </div>
          )}

          {/* Series + postUpdate badges */}
          {(post.seriesTitle || post.postUpdate) && (
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {post.seriesTitle && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,168,83,0.10)', color: 'var(--tr-gold)', border: '1px solid rgba(212,168,83,0.22)' }}>
                  <svg width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                  {post.seriesTitle}{post.seriesOrder != null && ` (${post.seriesOrder})`}
                </span>
              )}
              {post.postUpdate && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>
                  تحديث ★
                </span>
              )}
            </div>
          )}
        </Link>

        {/* Social summary - all screens */}
        <SocialSummary />

        {/* Desktop action bar */}
        <div className="hidden lg:block">
          <DesktopActionBar />
        </div>

        {/* Mobile action bar */}
        <div className="lg:hidden px-4 pb-4 pt-3 flex items-center gap-4 relative" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
          <div className="relative flex items-center gap-2">
            <button onClick={handleReactionAreaClick} aria-label={isRtl ? 'تفاعل' : 'React'} className="flex items-center gap-1.5 active:scale-90 transition-transform">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: currentReaction ? `${reactionConfig?.color ?? '#f59e0b'}18` : 'var(--tr-overlay)', border: `1.5px solid ${currentReaction ? (reactionConfig?.color ?? '#f59e0b') + '50' : 'var(--tr-border-soft)'}`, fontSize: currentReaction ? 18 : 15 }}>
                {currentReaction ? reactionEmoji(currentReaction) : <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--tr-text-muted)' }}><path d="M12 3l1.2 4.8L18 6.8l-3.6 3.6 1.2 5.4-3.6-2.4-3.6 2.4 1.2-5.4L6 6.8l4.8 1.2z" /></svg>}
              </div>
              <span className="text-sm font-semibold" style={{ color: currentReaction ? (reactionConfig?.color ?? '#f59e0b') : 'var(--tr-text-muted)' }}>{fmt(likeCount)}</span>
            </button>
            {showPicker && (
              <ReactionPicker currentReaction={currentReaction} onReact={(t) => handleReact(t)} onClose={() => setShowPicker(false)} isRtl={isRtl} />
            )}
          </div>

          <button onClick={handleCommentToggle} className="flex items-center gap-1.5 text-sm font-semibold transition" style={{ color: showCommentInput ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
            <IconComment size={18} />
            {fmt(commentCount)}
          </button>

          <button onClick={handleBookmarkClick} aria-label={isRtl ? 'حفظ' : 'Save'} className="flex items-center gap-1 text-sm font-semibold transition active:scale-90" style={{ color: isBookmarked ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
            <IconBookmark filled={isBookmarked} size={18} />
            {savedCount > 0 && <span>{fmt(savedCount)}</span>}
          </button>

          <div className="ms-auto flex items-center gap-2">
            <div ref={shareMenuRef} className="relative">
              <button onClick={handleShare} className="flex items-center gap-1 text-sm font-semibold transition" style={{ color: copied ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
                <IconShare size={18} check={copied} />
              </button>
              {showShareMenu && <ShareDropdown postId={post.id} title={post.title} content={post.content} onCopy={handleCopyLink} onClose={() => setShowShareMenu(false)} onSendDM={user ? handleOpenDMPicker : undefined} onNativeShare={handleNativeShare} isRtl={isRtl} />}
            </div>

            {user && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setShowOptions(true); }}
                aria-label={isRtl ? 'خيارات' : 'Options'}
                className="flex items-center gap-1 text-xs font-semibold transition active:scale-90"
                style={{ color: 'var(--tr-text-muted)' }}
              >
                <svg width={16} height={16} fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
              </button>
            )}
          </div>
        </div>

        {commentForm}
      </article>

      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
      {showBookmarkPicker && <BookmarkPicker isRtl={isRtl} folders={bmFolders} newFolderName={newFolderName} setNewFolderName={setNewFolderName} creatingFolder={creatingFolder} onSave={handleBookmarkSave} onCreate={handleCreateFolder} onClose={() => setShowBookmarkPicker(false)} />}
      {showOptions && <OptionsSheet isRtl={isRtl} postId={post.id} postUserId={post.userId ?? ''} isOwn={user?.id === post.userId} onReport={() => setShowReport(true)} onDeleted={() => { setShowOptions(false); onDeleted?.(post.id); }} onClose={() => setShowOptions(false)} />}
      {showReport && <ReportModal targetType="post" targetId={post.id} isRtl={isRtl} onClose={() => setShowReport(false)} />}
      {showReactors && <ReactorsModal postId={post.id} isRtl={isRtl} onClose={() => setShowReactors(false)} />}
      {showDMPicker && <DMPickerModal conversations={dmConversations} dmSending={dmSending} dmSent={dmSent} onSend={handleSendToDM} onClose={() => { setShowDMPicker(false); setDMSent(null); }} isRtl={isRtl} />}
    </>
  );
}

/* ── Reactors modal — who reacted and with what ─────────────────── */
function ReactorsModal({ postId, isRtl, onClose }: { postId: string; isRtl: boolean; onClose: () => void }) {
  const [reactors, setReactors] = useState<{ type: string; user: { id: string; name: string; avatarUrl?: string | null } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/tareeq/${postId}/react?users=1`, { signal: ctrl.signal, credentials: 'include' })
      .then(r => r.json())
      .then(d => setReactors(d.reactions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [postId]);

  const filtered = filter ? reactors.filter(r => r.type === filter) : reactors;
  const typeGroups = Array.from(new Set(reactors.map(r => r.type)));

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} />
      <div
        className="relative w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--tr-surface)', maxHeight: '75dvh', zIndex: 1 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
          <p className="font-black text-[15px]" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'التفاعلات' : 'Reactions'}
          </p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Filter tabs */}
        {typeGroups.length > 1 && (
          <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setFilter('')}
              className="text-xs font-bold px-3 py-1 rounded-full shrink-0 transition"
              style={!filter ? { background: 'var(--tr-gold)', color: '#fff' } : { background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}
            >
              {isRtl ? 'الكل' : 'All'} ({reactors.length})
            </button>
            {typeGroups.map(t => {
              const r = REACTIONS.find(x => x.type === t);
              return (
                <button key={t}
                  onClick={() => setFilter(t)}
                  className="text-xs font-bold px-3 py-1 rounded-full shrink-0 transition"
                  style={filter === t ? { background: r?.color ?? 'var(--tr-gold)', color: '#fff' } : { background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}
                >
                  {r?.emoji} {reactors.filter(x => x.type === t).length}
                </button>
              );
            })}
          </div>
        )}
        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 py-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'لا تفاعلات بعد' : 'No reactions yet'}</p>
          ) : (
            filtered.map((r) => {
              const rc = REACTIONS.find(x => x.type === r.type);
              return (
                <Link key={r.user.id} href={`/tareeq/u/${r.user.id}`} onClick={onClose} className="flex items-center gap-3 py-2.5 transition hover:bg-[var(--tr-overlay)] rounded-xl px-1 -mx-1" style={{ borderBottom: '1px solid var(--tr-border-subtle)', textDecoration: 'none' }}>
                  {r.user.avatarUrl ? (
                    <img src={r.user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}>
                      {r.user.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                  <p className="flex-1 text-sm font-semibold" style={{ color: 'var(--tr-text-primary)' }}>{r.user.name}</p>
                  <span className="text-lg shrink-0">{rc?.emoji ?? '⭐'}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Options sheet ────────────────────────────────────────────────── */
function OptionsSheet({ isRtl, postId, postUserId, isOwn, onReport, onDeleted, onClose }: {
  isRtl: boolean;
  postId: string;
  postUserId: string;
  isOwn: boolean;
  onReport: () => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [done, setDone] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tareeq/${postId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        onDeleted();
        return;
      }
    } catch { /* ignore */ }
    setDeleting(false);
    setConfirmDelete(false);
    setDone(isRtl ? 'حدث خطأ أثناء الحذف' : 'Failed to delete');
    setTimeout(onClose, 1800);
  }

  async function handleUnfollow() {
    try {
      const check = await fetch(`/api/tareeq/follow/${postUserId}`, { credentials: 'include' });
      const data = await check.json();
      if (!data.isFollowing) {
        setDone(isRtl ? 'أنت لا تتابع هذا الشخص' : 'You are not following this person');
        setTimeout(onClose, 1500);
        return;
      }
      const res = await fetch(`/api/tareeq/follow/${postUserId}`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      setDone(isRtl ? 'تم إلغاء المتابعة' : 'Unfollowed');
      setTimeout(onClose, 1300);
    } catch {
      setDone(isRtl ? 'حدث خطأ، حاول مجدداً' : 'Something went wrong');
      setTimeout(onClose, 1500);
    }
  }

  function handleNotInterested() {
    setDone(isRtl ? 'تم. لن يظهر لك هذا الشخص كثيرًا' : "Done. You'll see less from this person");
    setTimeout(onClose, 1500);
  }

  /* Shared row style */
  const row = 'w-full flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-black/5';

  return (
    <div
      /* Mobile: bottom-sheet — Desktop: centered small dropdown */
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm md:max-w-[280px]"
        style={{
          background: 'var(--tr-surface)',
          borderRadius: '20px 20px 0 0',
          borderTop: '1px solid var(--tr-border-subtle)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
        /* On desktop: full rounded corners */
        ref={el => {
          if (!el) return;
          if (window.innerWidth >= 768) {
            el.style.borderRadius = '16px';
            el.style.borderTop = '1px solid var(--tr-border-subtle)';
          }
        }}
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="md:hidden" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--tr-border-soft)', margin: '12px auto 8px' }} />

        {done ? (
          <div className="flex items-center justify-center py-6 px-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-primary)' }}>{done}</p>
          </div>
        ) : isOwn ? (
          /* ── Own post: delete only ── */
          <>
            <div className="px-5 py-3 hidden md:block" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'خيارات المنشور' : 'Post options'}</p>
            </div>
            {confirmDelete ? (
              /* ── Confirmation panel (replaces native confirm()) ── */
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--tr-text-primary)', textAlign: isRtl ? 'right' : 'left' }}>
                  {isRtl ? 'هل تريد حذف هذا المنشور نهائياً؟' : 'Delete this post permanently?'}
                </p>
                <div className="flex gap-3" dir={isRtl ? 'rtl' : 'ltr'}>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 disabled:opacity-50"
                    style={{ background: '#f43f5e', color: '#fff' }}
                  >
                    {deleting ? (isRtl ? 'جاري الحذف...' : 'Deleting...') : (isRtl ? 'نعم، احذف' : 'Yes, delete')}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
                    style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className={row}
                style={{ borderBottom: '1px solid var(--tr-border-subtle)', color: '#f43f5e' }}
              >
                <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="font-semibold text-sm">{isRtl ? 'حذف المنشور' : 'Delete Post'}</span>
              </button>
            )}
            {!confirmDelete && (
              <button onClick={onClose} className="w-full py-4 text-center text-sm font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
            )}
          </>
        ) : (
          /* ── Other's post: report / not interested / unfollow ── */
          <>
            <div className="px-5 py-3 hidden md:block" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'خيارات' : 'Options'}</p>
            </div>
            <button
              onClick={() => { onClose(); onReport(); }}
              className={row}
              style={{ borderBottom: '1px solid var(--tr-border-subtle)', color: '#f43f5e' }}
            >
              <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 21V8.742m.164-4.078a2.15 2.15 0 011.743-1.342 48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185V19.5M4.664 4.664L19.5 19.5" />
              </svg>
              <span className="font-semibold text-sm">{isRtl ? 'تبليغ عن المحتوى' : 'Report Content'}</span>
            </button>
            <button
              onClick={handleNotInterested}
              className={row}
              style={{ borderBottom: '1px solid var(--tr-border-subtle)', color: 'var(--tr-text-primary)' }}
            >
              <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6"/>
              </svg>
              <span className="text-sm">{isRtl ? 'لا أريد رؤية منشورات هذا الشخص' : "Don't show posts from this person"}</span>
            </button>
            <button
              onClick={handleUnfollow}
              className={row}
              style={{ borderBottom: '1px solid var(--tr-border-subtle)', color: 'var(--tr-text-primary)' }}
            >
              <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1M3 3l18 18" />
              </svg>
              <span className="text-sm">{isRtl ? 'إلغاء المتابعة' : 'Unfollow'}</span>
            </button>
            <button onClick={onClose} className="w-full py-4 text-center text-sm font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Report modal ─────────────────────────────────────────────────── */
const REPORT_REASONS_AR = ['محتوى مسيء أو غير لائق', 'سخرية أو مضايقة', 'كراهية أو تمييز', 'عنف أو إيذاء', 'معلومات مضللة', 'احتيال أو انتحال', 'انتهاك الخصوصية', 'محتوى مزعج أو متكرر', 'أخرى'];
const REPORT_REASONS_EN = ['Offensive or inappropriate content', 'Mockery or harassment', 'Hate or discrimination', 'Violence or harm', 'Misinformation', 'Fraud or impersonation', 'Privacy violation', 'Spam or repetitive content', 'Other'];

export function ReportModal({ targetType, targetId, isRtl, onClose }: {
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  isRtl: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!reason) { setError(isRtl ? 'اختر سبب البلاغ' : 'Select a reason'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/tareeq/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetType, targetId, reason, description: description.trim() }),
      });
      if (res.ok) { setDone(true); setTimeout(onClose, 1800); }
      else { const d = await res.json().catch(() => ({})); setError(d.error || (isRtl ? 'حدث خطأ' : 'Error')); }
    } catch { setError(isRtl ? 'خطأ في الاتصال' : 'Connection error'); }
    finally { setSubmitting(false); }
  }

  const reasons = isRtl ? REPORT_REASONS_AR : REPORT_REASONS_EN;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)', maxHeight: '90dvh', overflowY: 'auto' }}
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          <div className="flex flex-col items-center py-4 gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background: 'rgba(34,197,94,0.12)' }}>✅</div>
            <p className="font-bold text-sm" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'تم استلام بلاغك، شكرًا لمساعدتنا' : 'Report received, thank you'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>
                {isRtl ? 'إبلاغ عن المحتوى' : 'Report Content'}
              </h3>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full transition" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'اختر سبب البلاغ وسيراجعه فريق الإشراف' : 'Choose a reason and our moderation team will review it'}
            </p>

            <div className="flex flex-col">
              {reasons.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setReason(reasons[i])}
                  className="flex items-center gap-3 px-1 py-2 rounded-lg text-sm text-start transition"
                  style={{
                    color: reason === reasons[i] ? '#f43f5e' : 'var(--tr-text-secondary)',
                    fontWeight: reason === reasons[i] ? 600 : 400,
                  }}
                >
                  <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center border-2" style={{ borderColor: reason === reasons[i] ? '#f43f5e' : 'var(--tr-border-soft)' }}>
                    {reason === reasons[i] && <span className="w-2 h-2 rounded-full" style={{ background: '#f43f5e' }} />}
                  </span>
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={isRtl ? 'تفاصيل إضافية (اختياري)' : 'Additional details (optional)'}
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none transition"
              style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
            />

            {error && <p className="text-xs font-semibold text-center" style={{ color: '#f43f5e' }}>{error}</p>}

            <button
              onClick={submit}
              disabled={submitting || !reason}
              className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition"
              style={{ background: '#f43f5e', color: '#fff' }}
            >
              {submitting ? '...' : (isRtl ? 'إرسال البلاغ' : 'Submit Report')}
            </button>
          </>
        )}
      </div>
    </div>
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
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl p-6 pb-10 sm:rounded-3xl sm:pb-6" style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)' }} onClick={e => e.stopPropagation()}>
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

/* ── DM Picker Modal ────────────────────────────────────────────────── */
function DMPickerModal({ conversations, dmSending, dmSent, onSend, onClose, isRtl }: {
  conversations: { id: string; otherUser: { id: string; name: string; avatarUrl?: string | null } }[];
  dmSending: string | null; dmSent: string | null;
  onSend: (convId: string) => void; onClose: () => void; isRtl: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5" style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'إرسال إلى...' : 'Send to...'}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>✕</button>
        </div>
        {conversations.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'لا توجد محادثات بعد' : 'No conversations yet'}</p>
        ) : (
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {conversations.map(c => {
              const sent = dmSent === c.id;
              const sending = dmSending === c.id;
              return (
                <button key={c.id} onClick={() => !sent && onSend(c.id)} disabled={!!dmSending || sent}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-start transition"
                  style={{ background: sent ? 'rgba(34,197,94,0.08)' : 'var(--tr-overlay)', opacity: dmSending && !sending ? 0.5 : 1 }}>
                  <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold"
                    style={{ background: 'var(--tr-surface)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-border-soft)' }}>
                    {c.otherUser.avatarUrl
                      ? <img src={c.otherUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : c.otherUser.name.charAt(0)}
                  </div>
                  <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--tr-text-primary)' }}>{c.otherUser.name}</span>
                  {sending && <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: '#1a6ed4' }} />}
                  {sent && <span className="text-xs font-bold" style={{ color: '#22c55e' }}>{isRtl ? 'تم الإرسال ✓' : 'Sent ✓'}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Share dropdown ─────────────────────────────────────────────────── */
function ShareDropdown({ postId, title, content, onCopy, onClose, onSendDM, onNativeShare, isRtl }: {
  postId: string; title?: string | null; content: string;
  onCopy: (e: React.MouseEvent) => void; onClose: () => void;
  onSendDM?: () => void; onNativeShare?: (e: React.MouseEvent) => void; isRtl: boolean;
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
    <div className="absolute bottom-full end-0 mb-2 py-1.5 w-44 z-30 rounded-2xl" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 8px 28px rgba(0,0,0,0.14)' }}>
      {onSendDM && (
        <button onClick={e => { e.stopPropagation(); onClose(); onSendDM(); }} className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-semibold w-full hover:opacity-70 transition" style={{ color: 'var(--tr-text-secondary)' }}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#1a6ed4' }} />
          {isRtl ? 'إرسال برسالة' : 'Send in DM'}
        </button>
      )}
      {onNativeShare && typeof navigator !== 'undefined' && navigator.share && (
        <button onClick={e => { e.stopPropagation(); onClose(); onNativeShare(e); }} className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-semibold w-full hover:opacity-70 transition" style={{ color: 'var(--tr-text-secondary)' }}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#7c3aed' }} />
          {isRtl ? 'مشاركة خارجية' : 'Share externally'}
        </button>
      )}
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
