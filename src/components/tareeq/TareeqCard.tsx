'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TAREEQ_CATEGORIES, CATEGORY_COLORS } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import TareeqLoginGate from './TareeqLoginGate';

export interface TareeqPostSummary {
  id: string;
  title?: string | null;
  summary?: string | null;
  content: string;
  category?: string | null;
  tags?: unknown;
  imageUrl?: string | null;
  videoUrl?: string | null;
  authorName: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  userId?: string | null;
  user?: { id: string; name: string; avatarUrl?: string | null } | null;
}

function timeAgo(dateStr: string, isRtl: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return isRtl ? `منذ ${d} يوم` : `${d}d ago`;
  if (h > 0) return isRtl ? `منذ ${h} ساعة` : `${h}h ago`;
  return isRtl ? `منذ ${m || 1} دقيقة` : `${m || 1}m ago`;
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
  const [showGate, setShowGate] = useState(false);
  const [copied, setCopied] = useState(false);

  const catKey = post.category as TareeqCategoryKey | null;
  const catLabel = catKey && TAREEQ_CATEGORIES[catKey]
    ? (isRtl ? TAREEQ_CATEGORIES[catKey].ar : TAREEQ_CATEGORIES[catKey].en)
    : post.category;
  const categoryColor = catKey ? (CATEGORY_COLORS[catKey] ?? 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-600';
  const snippet = post.summary || post.content.slice(0, 160);
  const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { setShowGate(true); return; }
    // Optimistic update
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    const res = await fetch(`/api/tareeq/${post.id}/like`, { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      // Revert on failure
      setLiked(wasLiked);
      setLikeCount(c => wasLiked ? c + 1 : c - 1);
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

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden flex flex-col group">
        <Link href={`/tareeq/${post.id}`} className="flex flex-col flex-1 p-5 gap-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {post.user?.avatarUrl ? (
                <img src={post.user.avatarUrl} alt={post.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {post.authorName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-700 truncate">{post.authorName}</p>
                <p className="text-[10px] text-gray-400">{timeAgo(post.createdAt, isRtl)}</p>
              </div>
            </div>
            {catLabel && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${categoryColor}`}>
                {catLabel}
              </span>
            )}
          </div>

          {post.title && (
            <h3 className="font-black text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-purple-700 transition">
              {post.title}
            </h3>
          )}

          <p className="text-gray-600 text-xs leading-relaxed line-clamp-4 flex-1">{snippet}</p>

          {post.imageUrl && (
            <div className="rounded-xl overflow-hidden">
              <img src={post.imageUrl} alt="" className="w-full object-cover max-h-52" />
            </div>
          )}

          {!post.imageUrl && post.videoUrl && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-500">
              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {isRtl ? 'يحتوي على فيديو' : 'Contains a video'}
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
        <div className="px-5 pb-4 flex items-center gap-4">
          {/* Like — optimistic */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs font-semibold transition active:scale-110 ${liked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}
          >
            <svg className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>

          {/* Comments */}
          <Link
            href={`/tareeq/${post.id}#comments`}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 font-semibold transition"
            onClick={e => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            {post.commentCount > 0 && <span>{post.commentCount}</span>}
          </Link>

          {/* Share */}
          <button
            onClick={handleShare}
            className={`flex items-center gap-1 text-xs font-semibold transition ms-auto ${copied ? 'text-emerald-600' : 'text-gray-300 hover:text-gray-500'}`}
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
      </div>

      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}
    </>
  );
}
