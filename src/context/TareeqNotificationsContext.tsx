'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ensurePushSubscription } from '@/lib/tareeq-push-client';

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


/**
 * In-app chime.
 *
 * ONE AudioContext for the page, unlocked on the first user gesture — not a fresh one per
 * chime, which is what this used to do. A newly created AudioContext starts `suspended` on
 * mobile, and `resume()` is only granted inside a user-gesture callback. Called from the
 * 30-second poll there is no gesture, so resume never took effect and the chime was
 * silent: the sound only appeared after the user interacted with the page, which is why it
 * seemed to need a refresh.
 *
 * (This is the in-app sound only. With the app closed the sound comes from the OS
 * notification itself — see the push handler in tareeq-sw.js.)
 */
let sharedAudioCtx: AudioContext | null = null;
let audioUnlockBound = false;

function getAudioCtx(): AudioContext | null {
  const AudioCtx = typeof window === 'undefined'
    ? null
    : window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    try { sharedAudioCtx = new AudioCtx(); } catch { return null; }
  }
  return sharedAudioCtx;
}

/** Resumes the shared context from inside a real gesture, once. */
function bindAudioUnlock() {
  if (audioUnlockBound || typeof document === 'undefined') return;
  audioUnlockBound = true;
  const unlock = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ctx && ctx.state === 'running') {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('touchstart', unlock);
    }
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('touchstart', unlock, { passive: true });
}

function playChime() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    // Best-effort: outside a gesture this is a no-op, and the context stays suspended until
    // the unlock listener above catches a real one.
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); return; }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    // The context is REUSED, never closed — closing it would put the next chime back in the
    // suspended-without-a-gesture hole this fix exists to escape.
  } catch { /* audio not available */ }
}

/**
 * Whether the user explicitly turned push OFF.
 *
 * `PushSubscription.unsubscribe()` cannot revoke `Notification.permission`, so after an
 * opt-out the browser state ("granted, no subscription") is indistinguishable from a
 * subscription the browser dropped on its own — which the auto-recover effect is meant to
 * repair. This flag is what tells the two apart. Per-device by design.
 */
const OPT_OUT_KEY = 'tareeq-push-opted-out';
function pushOptedOut(): boolean {
  try { return localStorage.getItem(OPT_OUT_KEY) === '1'; } catch { return false; }
}
function setPushOptedOut(v: boolean) {
  try { if (v) localStorage.setItem(OPT_OUT_KEY, '1'); else localStorage.removeItem(OPT_OUT_KEY); } catch { /* blocked */ }
}

export function TareeqNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [pushPermission, setPushPermission] = useState<PushPermission>('unsupported');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevNotifRef = useRef(0);
  const prevMsgRef = useRef(0);
  const initialPollDone = useRef(false);
  // When a chime last played, from ANY source (poll or service worker).
  const lastChimeAtRef = useRef(0);

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

  // Detect initial push permission and keep subscription in sync with server.
  // Re-runs when user auth resolves. If the browser subscription was dropped
  // (SW update, VAPID key change, device switch), auto-recovers without a gesture
  // because Notification.permission is already 'granted' — only requestPermission()
  // needs a gesture, not subscribe().
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = Notification.permission as PushPermission;
    if (perm !== 'granted') { setPushPermission(perm); return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPushPermission(perm); return; }
    navigator.serviceWorker.ready.then(async reg => {
      let sub = await reg.pushManager.getSubscription();
      // Auto-recover: permission granted but no usable subscription → re-subscribe silently.
      // NOT when the user turned notifications off themselves: unsubscribing cannot revoke
      // Notification.permission (it stays 'granted'), so "no subscription + granted" looks
      // identical to a dropped subscription. Without this flag every re-run of this effect
      // silently turned push back on — and since AuthContext now revalidates on tab focus,
      // `user` gets a new identity (and this effect re-runs) about once a minute.
      //
      // "usable" includes the KEY: a subscription bound to a retired VAPID key is rejected
      // 403 for the rest of its life, so ensurePushSubscription replaces it rather than
      // handing the same dead one back.
      if (user && !pushOptedOut()) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
        if (vapidKey) sub = await ensurePushSubscription(reg, vapidKey);
      }
      setPushPermission(sub ? 'granted' : perm);
      if (sub && user) {
        fetch('/api/tareeq/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subscription: sub.toJSON() }),
        }).catch(() => {});
      }
    }).catch(() => setPushPermission(perm));
  }, [user]);

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
      // Coalesce to ONE chime per poll — a tick where both counters rose used to play
      // two overlapping oscillators.
      let shouldChime = false;
      if (nRes.ok) {
        const d = await nRes.json();
        const n = d.unreadCount ?? 0;
        if (initialPollDone.current && n > prevNotifRef.current) shouldChime = true;
        prevNotifRef.current = n;
        setNotifCount(n);
      }
      if (cRes.ok) {
        const d = await cRes.json();
        const m = d.unreadCount ?? 0;
        if (initialPollDone.current && m > prevMsgRef.current) shouldChime = true;
        prevMsgRef.current = m;
        setMessageCount(m);
      }
      // The service worker already chimes for a push that arrives while the tab is visible
      // (TAREEQ_PLAY_SOUND). Without this the poll would chime AGAIN for the same message
      // within 30s — the exact double-chime this coalescing was meant to remove.
      if (shouldChime && Date.now() - lastChimeAtRef.current > 30_000) {
        lastChimeAtRef.current = Date.now();
        playChime();
      }
      initialPollDone.current = true;
    } catch { /* ignore */ }
  }, [user]);

  // Adopt counts pushed by the service worker's periodic background sync.
  useEffect(() => {
    if (!user || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      // The SW chimed for this one; suppress the poll's own chime for the same event.
      if (data?.type === 'TAREEQ_PLAY_SOUND') { lastChimeAtRef.current = Date.now(); return; }
      if (!data || data.type !== 'TAREEQ_BADGE_UPDATE') return;
      if (typeof data.notifCount === 'number') {
        prevNotifRef.current = data.notifCount; // adopt silently — the SW already notified
        setNotifCount(data.notifCount);
      }
      if (typeof data.messageCount === 'number') {
        prevMsgRef.current = data.messageCount;
        setMessageCount(data.messageCount);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [user]);

  useEffect(() => {
    if (!user) { setNotifCount(0); setMessageCount(0); return; }
    poll();
    // Arm the audio unlock as soon as there is a signed-in user, so the FIRST tap anywhere
    // in the app makes every later chime audible — including ones fired from this timer.
    bindAudioUnlock();
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
    setPushOptedOut(false); // an explicit opt-in cancels a previous explicit opt-out
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { setPushPermission(permission as PushPermission); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
      // Replaces a subscription bound to a retired key instead of reusing it — reuse is
      // what made "turn notifications back on" a no-op after a key rotation.
      const sub = await ensurePushSubscription(reg, vapidKey);
      if (!sub) return;
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

  // NOTE: push permission is deliberately NOT auto-requested. This used to fire the OS
  // permission dialog on the user's first tap anywhere in the app — before they had seen
  // any reason to say yes, which is the surest way to get a permanent "denied". It also
  // contradicted useTareeqPush, which documents the opposite policy. Opt-in now happens
  // only through the explicit in-app banner (PushPermissionBanner) or the settings
  // toggle, both of which call enablePush() directly.

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
      setPushOptedOut(true);
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
