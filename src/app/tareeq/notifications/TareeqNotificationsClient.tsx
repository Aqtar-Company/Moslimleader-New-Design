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
        {n.body && <span className="block text-gray-400 text-xs mt-0.5 truncate">{n.body}</span>}
      </span>
    );
  }
  return (
    <span>
      {isRtl ? `رسالة جديدة من ${actor}` : `New message from ${actor}`}
      {n.body && <span className="block text-gray-400 text-xs mt-0.5 truncate">{n.body}</span>}
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
    <div className="min-h-screen bg-gray-50">
      <TareeqHeader onCreateClick={() => {}} />
      <div className="pt-11" />

      <div className="bg-[#0a1f1a] text-white py-8 px-4 text-center">
        <h1 className="font-black text-2xl">{isRtl ? 'الإشعارات' : 'Notifications'}</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-emerald-700 rounded-full animate-spin" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔔</div>
            <p className="text-gray-500 font-semibold">{isRtl ? 'لا إشعارات بعد' : 'No notifications yet'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-start flex items-start gap-3 p-4 rounded-2xl border transition hover:shadow-sm ${
                  n.read ? 'bg-white border-gray-100' : 'bg-emerald-50 border-emerald-100'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                  <NotifIcon type={n.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium leading-snug">
                    <NotifText n={n} isRtl={isRtl} />
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt, isRtl)}</p>
                </div>
                {!n.read && <span className="w-2 h-2 bg-emerald-500 rounded-full mt-2 shrink-0" />}
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
