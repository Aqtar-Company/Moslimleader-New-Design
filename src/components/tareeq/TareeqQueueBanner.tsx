'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';

export const QUEUE_KEY = 'tareeq-post-queue';

interface QueuedPost {
  id: string;
  content: string;
  category: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  queuedAt: number;
}

function loadQueue(): QueuedPost[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'); } catch { return []; }
}
function saveQueue(q: QueuedPost[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* ignore */ }
}

export function enqueuePost(post: Omit<QueuedPost, 'id' | 'queuedAt'>) {
  const q = loadQueue();
  q.push({ ...post, id: Math.random().toString(36).slice(2), queuedAt: Date.now() });
  saveQueue(q);
  window.dispatchEvent(new Event('tareeq-queue-changed'));
}

export default function TareeqQueueBanner() {
  const { user } = useAuth();
  const { isRtl } = useLang();
  const [queue, setQueue] = useState<QueuedPost[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  const refresh = useCallback(() => setQueue(loadQueue()), []);

  useEffect(() => {
    refresh();
    window.addEventListener('tareeq-queue-changed', refresh);
    return () => window.removeEventListener('tareeq-queue-changed', refresh);
  }, [refresh]);

  const retryAll = useCallback(async () => {
    if (!user || retrying) return;
    setRetrying(true);
    const current = loadQueue();
    const remaining: QueuedPost[] = [];
    for (const post of current) {
      try {
        const res = await fetch('/api/tareeq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: post.content, category: post.category, imageUrl: post.imageUrl, videoUrl: post.videoUrl }),
        });
        if (!res.ok) remaining.push(post);
      } catch {
        remaining.push(post);
      }
    }
    saveQueue(remaining);
    setQueue(remaining);
    setRetrying(false);
    if (remaining.length === 0) window.dispatchEvent(new Event('tareeq-refresh-feed'));
  }, [user, retrying]);

  const dismiss = useCallback(() => {
    saveQueue([]);
    setQueue([]);
  }, []);

  if (!user || queue.length === 0) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 text-sm"
      style={{ background: 'rgba(212,168,83,0.12)', borderBottom: '1px solid rgba(212,168,83,0.2)', position: 'sticky', top: 0, zIndex: 50 }}
    >
      <svg className="shrink-0" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tr-gold)" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span style={{ flex: 1, color: 'var(--tr-gold)', fontWeight: 600 }}>
        {isRtl
          ? `${queue.length} منشور في الانتظار`
          : `${queue.length} post${queue.length > 1 ? 's' : ''} queued`}
      </span>
      <button
        onClick={retryAll}
        disabled={retrying}
        className="text-xs font-bold px-3 py-1.5 rounded-full transition active:scale-95"
        style={{ background: 'var(--tr-gold)', color: '#0a0d06', opacity: retrying ? 0.6 : 1, border: 'none', cursor: retrying ? 'default' : 'pointer' }}
      >
        {retrying
          ? (isRtl ? 'جاري الإرسال...' : 'Sending...')
          : (isRtl ? 'إعادة الإرسال' : 'Retry')}
      </button>
      {confirmDismiss ? (
        <>
          <button onClick={dismiss} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: 'none', cursor: 'pointer' }}>
            {isRtl ? 'تجاهل' : 'Discard'}
          </button>
          <button onClick={() => setConfirmDismiss(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tr-text-muted)', padding: '2px 6px', fontSize: 18, lineHeight: 1 }}>×</button>
        </>
      ) : (
        <button onClick={() => setConfirmDismiss(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tr-text-muted)', padding: '2px 6px', fontSize: 18, lineHeight: 1 }} title={isRtl ? 'تجاهل المنشورات' : 'Discard posts'}>×</button>
      )}
    </div>
  );
}
