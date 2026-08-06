'use client';
import { useEffect, useRef } from 'react';

// Acquires a Screen Wake Lock while the component is mounted + the page is visible.
// Silently no-ops on browsers that don't support the API.
export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  async function acquire() {
    if (!('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible') return;
    try {
      lockRef.current = await (navigator as Navigator & {
        wakeLock: { request(type: 'screen'): Promise<WakeLockSentinel> };
      }).wakeLock.request('screen');
    } catch { /* permission denied or API error — ignore */ }
  }

  function release() {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
  }

  useEffect(() => {
    acquire();

    // Re-acquire when the tab becomes visible again (lock is auto-released on hide)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
      else release();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      release();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
