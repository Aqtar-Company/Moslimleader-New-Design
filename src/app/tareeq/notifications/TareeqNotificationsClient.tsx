'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import { requestTareeqPush } from '@/hooks/useTareeqPush';

interface TareeqNotif {
  id: string;
  type: string;
  actorId?: string | null;
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
  if (type === 'inspired') return <span className="text-base leading-none">⭐</span>;
  if (type === 'thanks')   return <span className="text-base leading-none">🙏</span>;
  if (type === 'agree')    return <span className="text-base leading-none">✊</span>;
  if (type === 'yarabb')   return <span className="text-base leading-none">🤲</span>;
  if (type === 'comment') return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-teal)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
  if (type === 'perk_new')    return <span className="text-base leading-none">🎁</span>;
  if (type === 'product_new') return <span className="text-base leading-none">🛍️</span>;
  if (type === 'follow') return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  );
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function NotifText({ n, isRtl }: { n: TareeqNotif; isRtl: boolean }) {
  const actor = n.actorName || (isRtl ? 'شخص ما' : 'Someone');
  const title = n.postTitle ? `«${n.postTitle}»` : '';
  if (n.type === 'like') {
    return <span>{isRtl ? `${actor} أعجب بعلامتك ${title}` : `${actor} liked your mark ${title}`}</span>;
  }
  if (n.type === 'inspired') {
    return <span>{isRtl ? `${actor} ألهمه علامتك ${title} ⭐` : `${actor} was inspired by your mark ${title} ⭐`}</span>;
  }
  if (n.type === 'thanks') {
    return <span>{isRtl ? `${actor} شكرك على علامتك ${title} 🙏` : `${actor} thanked you for ${title} 🙏`}</span>;
  }
  if (n.type === 'agree') {
    return <span>{isRtl ? `${actor} اتفق معك في علامتك ${title} ✊` : `${actor} agreed with your mark ${title} ✊`}</span>;
  }
  if (n.type === 'yarabb') {
    return <span>{isRtl ? `${actor} قال يارب على علامتك ${title} 🤲` : `${actor} said Yarabb on your mark ${title} 🤲`}</span>;
  }
  if (n.type === 'comment') {
    return (
      <span>
        {isRtl ? `${actor} علّق على ${title}` : `${actor} commented on ${title}`}
        {n.body && <span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--tr-text-muted)' }}>{n.body}</span>}
      </span>
    );
  }
  if (n.type === 'share') {
    return (
      <span>
        {isRtl ? `${actor} شارك علامتك 🔁` : `${actor} shared your mark 🔁`}
        {n.body && <span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--tr-text-muted)' }}>{n.body}</span>}
      </span>
    );
  }
  if (n.type === 'follow') {
    return <span>{isRtl ? `${actor} بدأ متابعتك` : `${actor} started following you`}</span>;
  }
  if (n.type === 'perk_new') {
    return (
      <span>
        {isRtl ? '✨ ميزة جديدة في عضويتك' : '✨ New membership benefit'}
        {n.body && <span className="block text-xs mt-0.5 truncate font-semibold" style={{ color: 'var(--tr-gold)' }}>{n.body}</span>}
      </span>
    );
  }
  if (n.type === 'product_new') {
    return (
      <span>
        {isRtl ? '🛍️ منتج جديد في المتجر' : '🛍️ New product in the store'}
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

function PushPermissionBanner({ isRtl }: { isRtl: boolean }) {
  const [perm, setPerm] = useState<NotificationPermission | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if ('Notification' in window) setPerm(Notification.permission);
  }, []);

  if (perm === 'granted' || perm === 'denied' || perm === null) return null;

  return (
    <div className="mt-4 mx-auto max-w-sm flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'var(--tr-gold-glow)', border: '1px solid var(--tr-gold-dim)' }}>
        <svg width={18} height={18} fill="none" stroke="var(--tr-gold)" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      </div>
      <p className="text-xs font-semibold flex-1 text-start" style={{ color: 'var(--tr-text-secondary)' }}>
        {isRtl ? 'فعّل الإشعارات لتصلك رسائل وردود على الفور' : 'Enable notifications to get messages instantly'}
      </p>
      <button
        disabled={requesting}
        onClick={async () => {
          setRequesting(true);
          const result = await requestTareeqPush();
          setPerm(result);
          setRequesting(false);
        }}
        className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95"
        style={{ background: 'var(--tr-gold)', color: '#080E1C', opacity: requesting ? 0.6 : 1 }}>
        {requesting ? '...' : (isRtl ? 'تفعيل' : 'Enable')}
      </button>
    </div>
  );
}

/**
 * The nine notification switches.
 *
 * Nine notification types existed and the only control anyone had was the browser's
 * all-or-nothing permission — so a user annoyed by "someone liked your mark" had to give
 * up "you have a new message" to be rid of it.
 *
 * Collapsed by default: this page is opened to read notifications, not to configure them,
 * and nine rows above the list would bury what the user came for.
 */
function NotificationSettings({ isRtl }: { isRtl: boolean }) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<{ key: string; ar: string; en: string }[]>([]);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetched on first open, not on mount: most visits never touch this.
  useEffect(() => {
    if (!open || loaded) return;
    fetch('/api/tareeq/settings/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setGroups(d.groups ?? []); setPrefs(d.prefs ?? {}); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [open, loaded]);

  async function toggle(key: string, enabled: boolean) {
    setSaving(key);
    // Optimistic: a switch that waits on the network feels broken.
    setPrefs(p => { const n = { ...p }; if (enabled) delete n[key]; else n[key] = false; return n; });
    try {
      const res = await fetch('/api/tareeq/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, enabled }),
      });
      // Roll back rather than leave the switch showing a state the server rejected.
      if (!res.ok) setPrefs(p => { const n = { ...p }; if (enabled) n[key] = false; else delete n[key]; return n; });
      else { const d = await res.json(); if (d.prefs) setPrefs(d.prefs); }
    } catch {
      setPrefs(p => { const n = { ...p }; if (enabled) n[key] = false; else delete n[key]; return n; });
    } finally {
      setSaving(null);
    }
  }

  const offCount = Object.values(prefs).filter(v => v === false).length;

  return (
    <div className="mt-4 mx-auto max-w-sm">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl transition"
        style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}
      >
        <svg width={16} height={16} fill="none" stroke="var(--tr-text-muted)" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-xs font-bold flex-1 text-start" style={{ color: 'var(--tr-text-secondary)' }}>
          {isRtl ? 'إعدادات الإشعارات' : 'Notification settings'}
        </span>
        {offCount > 0 && (
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}>
            {isRtl ? `${offCount} مُوقف` : `${offCount} off`}
          </span>
        )}
        <svg width={14} height={14} fill="none" stroke="var(--tr-text-muted)" strokeWidth={2.5} viewBox="0 0 24 24"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 rounded-2xl overflow-hidden" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
          {!loaded ? (
            <p className="text-xs px-4 py-4 text-center" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'جاري التحميل...' : 'Loading...'}
            </p>
          ) : groups.map((g, i) => {
            // Absent key means on — the same rule the server uses, so the switch cannot
            // disagree with what actually gets delivered.
            const on = prefs[g.key] !== false;
            return (
              <label
                key={g.key}
                htmlFor={`notif-${g.key}`}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--tr-border-subtle)' }}
              >
                <span className="text-[13px] font-semibold flex-1 text-start" style={{ color: 'var(--tr-text-primary)' }}>
                  {isRtl ? g.ar : g.en}
                </span>
                <input
                  id={`notif-${g.key}`}
                  type="checkbox"
                  checked={on}
                  disabled={saving === g.key}
                  onChange={e => toggle(g.key, e.target.checked)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className="shrink-0 rounded-full transition-colors"
                  style={{
                    width: 40, height: 22, padding: 2,
                    background: on ? 'var(--tr-gold)' : 'var(--tr-border-soft)',
                    opacity: saving === g.key ? 0.5 : 1,
                    display: 'flex',
                    justifyContent: on ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', display: 'block' }} />
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Inner() {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { refresh } = useTareeqNotifications();
  const router = useRouter();
  const [notifs, setNotifs] = useState<TareeqNotif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch('/api/tareeq/notifications?limit=50', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setNotifs((d.notifications ?? []).filter((n: TareeqNotif) => n.type !== 'message')))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Mark all read
    fetch('/api/tareeq/notifications', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(() => refresh())
      .catch(() => {});
  }, [user, refresh]);

  function handleClick(n: TareeqNotif) {
    if (n.type === 'message' && n.postId) {
      router.push(`/tareeq/inbox/${n.postId}`);
    } else if (n.type === 'message') {
      router.push('/tareeq/inbox');
    } else if (n.type === 'follow' && n.actorId) {
      router.push(`/tareeq/u/${n.actorId}`);
    } else if (n.type === 'perk_new') {
      router.push('/membership');
    } else if (n.type === 'product_new' && n.postId) {
      router.push(`/shop/${n.postId}`);
    } else if (n.type === 'product_new') {
      router.push('/shop');
    } else if (n.postId) {
      router.push(`/tareeq/${n.postId}`);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="py-8 px-4 text-center">
        <h1 className="font-black text-2xl" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'الإشعارات' : 'Notifications'}</h1>
        <PushPermissionBanner isRtl={isRtl} />
        <NotificationSettings isRtl={isRtl} />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-2">
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

// TareeqShell (src/app/tareeq/layout.tsx) already wraps every /tareeq page in a
// TareeqNotificationsProvider — nesting a second one here doubled the 30s polling and
// its badge/setAppBadge effects, and this page's own `refresh()` calls (e.g. mark-all-
// read) only updated this inner provider, leaving the header's bell badge (bound to the
// outer one) stale until its own next poll.
export default function TareeqNotificationsClient() {
  return <Inner />;
}
