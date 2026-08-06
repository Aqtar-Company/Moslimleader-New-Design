'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

interface TareeqNotificationsCtx {
  notifCount: number;
  messageCount: number;
  refresh: () => void;
  pushPermission: PushPermission;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const Ctx = createContext<TareeqNotificationsCtx>({
  notifCount: 0, messageCount: 0, refresh: () => {},
  pushPermission: 'unsupported', enablePush: async () => {}, disablePush: async () => {},
});

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function TareeqNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [pushPermission, setPushPermission] = useState<PushPermission>('unsupported');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Register service worker + periodic background sync (badge update)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/tareeq-sw.js', { scope: '/tareeq' })
      .then(async reg => {
        type PeriodicSyncReg = ServiceWorkerRegistration & {
          periodicSync: { register(tag: string, opts: { minInterval: number }): Promise<void> };
        };
        const psReg = reg as PeriodicSyncReg;
        if ('periodicSync' in reg) {
          const perm = await (navigator.permissions as unknown as {
            query(d: { name: string }): Promise<{ state: string }>;
          }).query({ name: 'periodic-background-sync' }).catch(() => ({ state: 'denied' }));
          if (perm.state === 'granted') {
            await psReg.periodicSync.register('tareeq-badge', { minInterval: 15 * 60 * 1000 }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  // Detect initial push permission.
  // If OS reports 'granted', verify a subscription actually exists — the user may have
  // called disablePush() which removes the subscription but leaves the OS permission intact.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = Notification.permission as PushPermission;
    if (perm !== 'granted') { setPushPermission(perm); return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPushPermission(perm); return; }
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        setPushPermission(sub ? 'granted' : 'default');
        // Re-sync active subscription with server on page load
        if (sub) {
          fetch('/api/tareeq/push-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ subscription: sub.toJSON() }),
          }).catch(() => {});
        }
      })
    ).catch(() => setPushPermission(perm));
  }, []);

  // Update PWA app-icon badge (Badging API)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    const total = notifCount + messageCount;
    if (total > 0) {
      (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(total).catch(() => {});
    } else {
      (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => {});
    }
  }, [notifCount, messageCount]);

  const poll = useCallback(async () => {
    if (!user || document.hidden) return;
    try {
      const [nRes, cRes] = await Promise.all([
        fetch('/api/tareeq/notifications?countOnly=true', { credentials: 'include' }),
        fetch('/api/tareeq/conversations?countOnly=true', { credentials: 'include' }),
      ]);
      if (nRes.ok) { const d = await nRes.json(); setNotifCount(d.unreadCount ?? 0); }
      if (cRes.ok) { const d = await cRes.json(); setMessageCount(d.unreadCount ?? 0); }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!user) { setNotifCount(0); setMessageCount(0); return; }
    poll();
    timerRef.current = setInterval(poll, 30_000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, poll]);

  const enablePush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { setPushPermission(permission as PushPermission); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });
      }
      await fetch('/api/tareeq/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      // Only mark as granted after the subscription is confirmed server-side
      setPushPermission('granted');
    } catch { /* subscription failed — don't show "On" */ }
  }, []);

  const disablePush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setPushPermission('default'); return; }
      // Notify server (non-fatal: browser-side unsubscribe always runs regardless)
      await fetch('/api/tareeq/push-unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
      setPushPermission('default');
    } catch { /* ignore */ }
  }, []);

  return (
    <Ctx.Provider value={{ notifCount, messageCount, refresh: poll, pushPermission, enablePush, disablePush }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTareeqNotifications() {
  return useContext(Ctx);
}
