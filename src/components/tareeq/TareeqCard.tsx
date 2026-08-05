'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TAREEQ_CATEGORIES, CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_ACCENT_HEX } from '@/lib/tareeq-constants';
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
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const catKey = post.category as TareeqCategoryKey | null;
  const catLabel = catKey && TAREEQ_CATEGORIES[catKey]
    ? (isRtl ? TAREEQ_CATEGORIES[catKey].ar : TAREEQ_CATEGORIES[catKey].en)
    : post.category;
  const catIcon = catKey ? (CATEGORY_ICONS[catKey] ?? '') : '';
  const categoryColor = catKey ? (CATEGORY_COLORS[catKey] ?? 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-600';
  const accentHex = catKey ? (CATEGORY_ACCENT_HEX[catKey] ?? undefined) : undefined;
  const snippet = post.summary || post.content.slice(0, 160);
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const hasImage = !!post.imageUrl;

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { setShowGate(true); return; }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => Math.max(0, wasLiked ? c - 1 : c + 1));
    const res = await fetch(`/api/tareeq/${post.id}/like`, { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      setLiked(wasLiked);
      setLikeCount(c => Math.max(0, wasLiked ? c + 1 : c - 1));
    }
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    const url = `${window.location.origin}/tareeq/${post.id}`;
    const text = post.title || post.content.slice(0, 80);
    if (navigator.share) {
      await navigator.share({ title: text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  return (
    <>
      <article
        className="bg-white rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-gray-100 overflow-hidden flex flex-col group"
        style={!hasImage && accentHex
          ? { borderInlineStartWidth: '4px', borderInlineStartColor: accentHex }
          : undefined}
      >
        {/* Image at top — full bleed */}
        {hasImage && (
          <Link href={`/tareeq/${post.id}`} className="relative w-full shrink-0 overflow-hidden bg-gray-100 block" style={{ aspectRatio: '4/3' }}>
            <img
              src={post.imageUrl!}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {catLabel && (
              <span className={`absolute top-3 start-3 text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${categoryColor}`}>
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
                <img src={post.user.avatarUrl} alt={post.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {post.authorName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{post.authorName}</p>
                <p className="text-[10px] text-gray-400">{timeAgo(post.createdAt, isRtl)}</p>
              </div>
            </div>
            {/* Category badge — only for text-only posts */}
            {!hasImage && catLabel && (
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${categoryColor}`}>
                {catIcon} {catLabel}
              </span>
            )}
          </div>

          {post.title && (
            <h3 className="font-black text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-purple-700 transition">
              {post.title}
            </h3>
          )}

          <p className="text-gray-600 text-xs leading-relaxed line-clamp-4 flex-1">{snippet}</p>

          {/* Video badge */}
          {!hasImage && post.videoUrl && (
            <div className="flex items-center gap-2.5 bg-gray-900 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white ms-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-xs text-white/70 font-medium">
                {isRtl ? 'يحتوي على فيديو' : 'Contains a video'}
              </span>
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 4).map((tag) => (
                <span key={tag} className="text-[10px] bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </Link>

        {/* Footer actions */}
        <div className="px-5 pb-4 pt-3 flex items-center gap-4 border-t border-gray-50">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs font-semibold transition active:scale-110 ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}
          >
            <svg className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <span>{likeCount}</span>
          </button>

          {/* Comment toggle */}
          <button
            onClick={handleCommentToggle}
            className={`flex items-center gap-1.5 text-xs font-semibold transition ${showCommentInput ? 'text-purple-600' : 'text-gray-400 hover:text-purple-500'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span>{commentCount}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className={`flex items-center gap-1 text-xs font-semibold transition ms-auto ${copied ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
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
        </div>

        {/* Inline comment form */}
        {showCommentInput && (
          <form
            onSubmit={handleComment}
            onClick={e => e.stopPropagation()}
            className="px-5 pb-4 pt-3 flex gap-2 items-center border-t border-gray-50"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {user?.name.charAt(0) ?? '?'}
              </div>
            )}
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setShowCommentInput(false); } }}
              placeholder={isRtl ? 'أضف تعليقاً...' : 'Add a comment...'}
              maxLength={500}
              className="flex-1 min-w-0 border border-gray-200 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
            />
            <button
              type="submit"
              disabled={submitting || commentText.trim().length < 2}
              className="bg-[#1a1a2e] text-white px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-40 hover:bg-gray-800 transition shrink-0"
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
