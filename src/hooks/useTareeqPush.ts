'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

import { ensurePushSubscription, pushOptedOut, setPushOptedOut } from '@/lib/tareeq-push-client';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function useTareeqPush() {
  const { user } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (!user || attempted.current) return;
    if (!VAPID_PUBLIC) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    attempted.current = true;

    (async () => {
      try {
        // Only prompt if permission not yet decided
        if (Notification.permission === 'denied') return;

        // Don't auto-prompt — wait for permission to be 'granted' (the user may have
        // allowed it via the install/settings flow).
        if (Notification.permission !== 'granted') return;
        // And never re-arm push the user turned off. This effect runs on every load of the
        // feed, and it did not check the flag — so switching notifications off lasted
        // exactly until the next reload, which re-subscribed and re-registered silently.
        if (pushOptedOut()) return;

        const reg = await navigator.serviceWorker.ready;
        // ensurePushSubscription, NOT getSubscription() → reuse. This path used to re-save
        // whatever the browser was holding, which after a key rotation meant re-saving a
        // subscription the push service rejects with 403 forever.
        const sub = await ensurePushSubscription(reg, VAPID_PUBLIC);
        if (sub) await syncSubscription(sub);
      } catch { /* ignore — offline or permission denied */ }
    })();
  }, [user]);
}

async function syncSubscription(sub: PushSubscription) {
  try {
    await fetch('/api/tareeq/push-subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
  } catch { /* ignore */ }
}

// Call this when the user explicitly grants permission (e.g. from settings)
export async function requestTareeqPush(): Promise<'granted' | 'denied' | 'default'> {
  if (!VAPID_PUBLIC) return 'denied';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'denied';

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission as 'denied' | 'default';

    // An explicit opt-in cancels a previous explicit opt-out (see
    // TareeqNotificationsContext — same key, same meaning).
    setPushOptedOut(false);

    const reg = await navigator.serviceWorker.ready;
    // Handles both traps in one place: a bare subscribe() throws InvalidStateError when a
    // subscription already exists (which used to be reported to the user as 'denied'), and
    // a bare reuse keeps a subscription bound to a retired key alive forever.
    const sub = await ensurePushSubscription(reg, VAPID_PUBLIC);
    if (!sub) return 'denied';
    await syncSubscription(sub);
    return 'granted';
  } catch {
    return 'denied';
  }
}
