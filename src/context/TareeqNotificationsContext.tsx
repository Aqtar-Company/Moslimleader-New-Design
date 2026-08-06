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

  // Register service worker
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/tareeq-sw.js', { scope: '/tareeq' }).catch(() => {});
  }, []);

  // Detect initial push permission
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPushPermission(Notification.permission as PushPermission);
  }, []);

  // Auto-resubscribe if permission already granted (page reload / new device)
  useEffect(() => {
    if (!user || pushPermission !== 'granted') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        if (!sub) return;
        fetch('/api/tareeq/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subscription: sub.toJSON() }),
        }).catch(() => {});
      })
    ).catch(() => {});
  }, [user, pushPermission]);

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
    if (!user || typeof document !== 'undefined' && document.hidden) return;
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
    setPushPermission(permission as PushPermission);
    if (permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      await fetch('/api/tareeq/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch { /* ignore */ }
  }, []);

  const disablePush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await fetch('/api/tareeq/push-unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
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
