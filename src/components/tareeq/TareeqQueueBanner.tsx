'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';

export const QUEUE_KEY = 'tareeq-post-queue';

interface QueuedPost {
  id: string;
  content: string;
  category: string | null;
  imageUrl: string | null;
  // The composer writes all of these; the replay used to send only content/category/
  // imageUrl/videoUrl, so a 5-image carousel published as one image, a video lost its
  // custom cover, and a series post lost its series.
  imageUrls?: string[] | null;
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  seriesTitle?: string | null;
  queuedAt: number;
  /** Failed attempts so far. A permanently-rejected post must not retry forever. */
  attempts?: number;
}

const MAX_ATTEMPTS = 5;

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
  const retryingRef = useRef(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  const refresh = useCallback(() => setQueue(loadQueue()), []);

  useEffect(() => {
    refresh();
    window.addEventListener('tareeq-queue-changed', refresh);
    return () => window.removeEventListener('tareeq-queue-changed', refresh);
  }, [refresh]);

  // Auto-send when the connection comes back. Nothing replayed this queue on its own —
  // a post composed offline just sat there until the user happened to notice the banner
  // and press Retry, which doesn't match the app's "works offline" promise.
  const retryAll = useCallback(async () => {
    // A ref, not the `retrying` state: the `online` listener below is registered once and
    // closes over the render where `retrying` was false, so the state check never fired
    // for it. Two overlapping replays read the same queue and published duplicates.
    if (!user || retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    const current = loadQueue();
    const remaining: QueuedPost[] = [];
    let published = 0;
    for (const post of current) {
      const attempts = (post.attempts ?? 0) + 1;
      try {
        const res = await fetch('/api/tareeq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            content: post.content, category: post.category,
            imageUrl: post.imageUrl, imageUrls: post.imageUrls ?? undefined,
            videoUrl: post.videoUrl, thumbnailUrl: post.thumbnailUrl ?? undefined,
            seriesTitle: post.seriesTitle ?? undefined,
          }),
        });
        // `res.ok` alone is not proof of publication: a captive portal answers 200 with an
        // HTML login page, and dropping the post on that would destroy it unrecoverably.
        // The real API always answers JSON with the created post's id.
        let confirmed = false;
        if (res.ok) {
          const d = await res.json().catch(() => null);
          confirmed = !!(d && (d.post?.id || d.id));
        }
        if (confirmed) { published++; continue; }
        // Client errors other than rate-limiting are permanent — retrying them on every
        // `online` event and every re-render would never succeed.
        const permanent = res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 401;
        if (!permanent && attempts < MAX_ATTEMPTS) remaining.push({ ...post, attempts });
      } catch {
        if (attempts < MAX_ATTEMPTS) remaining.push({ ...post, attempts });
      }
    }
    saveQueue(remaining);
    setQueue(remaining);
    retryingRef.current = false;
    setRetrying(false);
    if (published > 0) window.dispatchEvent(new Event('tareeq-refresh-feed'));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onOnline = () => { if (loadQueue().length > 0) void retryAll(); };
    window.addEventListener('online', onOnline);
    // Also try once on mount in case we came back while the tab was closed/backgrounded.
    if (navigator.onLine && loadQueue().length > 0) void retryAll();
    return () => window.removeEventListener('online', onOnline);
  }, [user, retryAll]);

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
