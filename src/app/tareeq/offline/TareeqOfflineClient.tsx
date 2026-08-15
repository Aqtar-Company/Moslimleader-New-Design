'use client';
import { useEffect, useState, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import {
  getAllOfflinePosts, clearAllOfflinePosts, removePostOffline,
  getOfflineStorageBytes, type OfflinePost,
} from '@/lib/tareeq-idb';

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso: string, isRtl: boolean): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return isRtl ? 'الآن'            : 'just now';
  if (diff < 3600)  return isRtl ? `منذ ${Math.floor(diff / 60)} د`    : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return isRtl ? `منذ ${Math.floor(diff / 3600)} س`  : `${Math.floor(diff / 3600)}h ago`;
  return isRtl ? `منذ ${Math.floor(diff / 86400)} ي` : `${Math.floor(diff / 86400)}d ago`;
}

export default function TareeqOfflineClient() {
  const { isRtl } = useLang();
  const [posts,   setPosts]   = useState<OfflinePost[]>([]);
  const [bytes,   setBytes]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [p, b] = await Promise.all([getAllOfflinePosts(), getOfflineStorageBytes()]);
    setPosts(p);
    setBytes(b);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleRemove(id: string) {
    await removePostOffline(id);
    reload();
  }

  async function handleClearAll() {
    await clearAllOfflinePosts();
    setConfirmClear(false);
    reload();
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15.75a.75.75 0 00.75.75h16.5a.75.75 0 00.75-.75V8.25a.75.75 0 00-.75-.75H3.75a.75.75 0 00-.75.75v7.5zm9.75-6.75h.008v.008h-.008V9zm0 3h.008v.008h-.008V12zm0 3h.008v.008h-.008V15z" />
            </svg>
          </div>
          <div>
            <h1 className="font-black text-lg" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'القراءة بدون إنترنت' : 'Offline Reading'}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'المنشورات المحفوظة على جهازك' : 'Posts saved on your device'}
            </p>
          </div>
        </div>
        {posts.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="text-xs px-3 py-1.5 rounded-full transition"
            style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-muted)', border: '1px solid var(--tr-border-soft)' }}
          >
            {isRtl ? 'مسح الكل' : 'Clear all'}
          </button>
        )}
      </div>

      {/* Confirm clear */}
      {confirmClear && (
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-4" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
          <p className="text-sm flex-1" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'هل أنت متأكد من مسح جميع المنشورات المحفوظة؟' : 'Clear all saved posts?'}
          </p>
          <button onClick={handleClearAll} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: '#f43f5e', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {isRtl ? 'مسح' : 'Clear'}
          </button>
          <button onClick={() => setConfirmClear(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tr-text-muted)', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
        </div>
      )}

      {/* Storage usage */}
      {bytes > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-5" style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="var(--tr-text-muted)" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 003 3h7.5a3 3 0 003-3m-3-3V6a2.25 2.25 0 00-2.25-2.25H9A2.25 2.25 0 006.75 6v5.25m13.5 0a3 3 0 00-3-3m0 0V6a2.25 2.25 0 00-2.25-2.25H9A2.25 2.25 0 006.75 6" />
          </svg>
          <span className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl
              ? `مساحة المحتوى المحفوظ: ${formatBytes(bytes)}`
              : `Offline storage used: ${formatBytes(bytes)}`}
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--tr-raised)' }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4" style={{ color: 'var(--tr-text-muted)' }}>
          <span className="text-5xl opacity-30">📴</span>
          <p className="text-sm text-center">
            {isRtl
              ? 'لا منشورات محفوظة — اضغط على أيقونة 📥 في أي منشور لحفظه'
              : 'No saved posts — tap 📥 on any post to save it'}
          </p>
        </div>
      )}

      {/* Post list */}
      {!loading && posts.map(post => (
        <article
          key={post.id}
          className="p-4 rounded-2xl mb-3"
          style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
        >
          {/* Author + time */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}>
                {post.authorName[0]}
              </div>
              <span className="text-xs font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{post.authorName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>
                {timeAgo(post.createdAt, isRtl)}
              </span>
              <button
                onClick={() => handleRemove(post.id)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tr-text-muted)' }}
                title={isRtl ? 'إزالة' : 'Remove'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          {post.title && (
            <p className="font-bold text-sm mb-1" style={{ color: 'var(--tr-text-primary)' }}>{post.title}</p>
          )}
          <p className="text-sm leading-relaxed line-clamp-4" style={{ color: 'var(--tr-text-secondary)', whiteSpace: 'pre-wrap' }}>
            {post.content}
          </p>

          {/* Image */}
          {(post.imageUrl || post.imageUrls?.[0]) && (
            <img
              src={post.imageUrls?.[0] ?? post.imageUrl!}
              alt=""
              className="w-full rounded-xl mt-3 object-cover"
              style={{ maxHeight: 220 }}
            />
          )}

          {/* Saved indicator */}
          <p className="text-[10px] mt-3" style={{ color: 'var(--tr-text-muted)', opacity: 0.6 }}>
            {isRtl ? 'حُفظ ' : 'Saved '}
            {timeAgo(new Date(post.savedAt).toISOString(), isRtl)}
          </p>
        </article>
      ))}
    </div>
  );
}
