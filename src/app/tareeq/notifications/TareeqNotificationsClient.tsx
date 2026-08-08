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
  if (type === 'like') return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#f43f5e' }}>
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  );
  if (type === 'comment') return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-teal)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
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
    if (n.type === 'message' && n.postId) {
      router.push(`/tareeq/inbox/${n.postId}`);
    } else if (n.type === 'message') {
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
            <svg className="w-14 h-14 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
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
