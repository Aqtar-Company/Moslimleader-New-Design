'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import { TareeqNotificationsProvider, useTareeqNotifications } from '@/context/TareeqNotificationsContext';

interface Notification {
  id: string;
  type: string;
  actorName?: string | null;
  postId?: string | null;
  postTitle?: string | null;
  body?: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(iso: string, isRtl: boolean): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return isRtl ? 'الآن' : 'just now';
  if (diff < 3600) return isRtl ? `${Math.floor(diff/60)} د` : `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return isRtl ? `${Math.floor(diff/3600)} س` : `${Math.floor(diff/3600)}h ago`;
  return isRtl ? `${Math.floor(diff/86400)} ي` : `${Math.floor(diff/86400)}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'like') return <span className="text-rose-400 text-base">❤️</span>;
  if (type === 'comment') return <span className="text-emerald-400 text-base">💬</span>;
  return <span className="text-blue-400 text-base">✉️</span>;
}

function NotifText({ n, isRtl }: { n: Notification; isRtl: boolean }) {
  const actor = n.actorName || (isRtl ? 'شخص ما' : 'Someone');
  const title = n.postTitle ? `«${n.postTitle}»` : '';
  if (n.type === 'like') {
    return <span>{isRtl ? `${actor} أعجب بعلامتك ${title}` : `${actor} liked your mark ${title}`}</span>;
  }
  if (n.type === 'comment') {
    return (
      <span>
        {isRtl ? `${actor} علّق على ${title}` : `${actor} commented on ${title}`}
        {n.body && <span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--tr-text-muted)' }}>{n.body}</span>}
      </span>
    );
  }
  return (
    <span>
      {isRtl ? `رسالة جديدة من ${actor}` : `New message from ${actor}`}
      {n.body && <span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--tr-text-muted)' }}>{n.body}</span>}
    </span>
  );
}

function Inner() {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { refresh } = useTareeqNotifications();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch('/api/tareeq/notifications?limit=50', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setNotifs(d.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Mark all read
    fetch('/api/tareeq/notifications', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(() => refresh())
      .catch(() => {});
  }, [user, refresh]);

  function handleClick(n: Notification) {
    if (n.type === 'message') {
      router.push('/tareeq/inbox');
    } else if (n.postId) {
      router.push(`/tareeq/${n.postId}`);
    }
  }

  return (
    <div className="min-h-screen">
      <TareeqHeader onCreateClick={() => {}} />

      <div className="py-8 px-4 text-center">
        <h1 className="font-black text-2xl" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'الإشعارات' : 'Notifications'}</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-2 pb-28">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔔</div>
            <p className="font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'لا إشعارات بعد' : 'No notifications yet'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className="w-full text-start flex items-start gap-3 p-4 rounded-2xl transition"
                style={{
                  background: n.read ? 'var(--tr-surface)' : 'var(--tr-raised)',
                  border: n.read ? '1px solid var(--tr-border-subtle)' : '1px solid var(--tr-gold-dim)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.read ? 'var(--tr-surface)' : 'var(--tr-raised)'; }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
                  <NotifIcon type={n.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug" style={{ color: 'var(--tr-text-primary)' }}>
                    <NotifText n={n} isRtl={isRtl} />
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(n.createdAt, isRtl)}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: 'var(--tr-gold)' }} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TareeqNotificationsClient() {
  return (
    <TareeqNotificationsProvider>
      <Inner />
    </TareeqNotificationsProvider>
  );
}
