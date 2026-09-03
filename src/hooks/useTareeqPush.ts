'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

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

        const reg = await navigator.serviceWorker.ready;

        // Check if already subscribed
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Re-register to server in case it was lost
          await syncSubscription(existing);
          return;
        }

        // Don't auto-prompt — wait for permission to be 'granted' (user may
        // have already allowed it via the app's install/settings flow)
        if (Notification.permission !== 'granted') return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
        });

        await syncSubscription(sub);
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

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
    });
    await syncSubscription(sub);
    return 'granted';
  } catch {
    return 'denied';
  }
}
