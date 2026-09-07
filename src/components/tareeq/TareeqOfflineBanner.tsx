'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/context/LanguageContext';

export default function TareeqOfflineBanner() {
  const { isRtl } = useLang();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // navigator.onLine only means "there is a network interface" — it stays true on a
    // captive portal or a connection with no route to us. Confirm with a cheap probe
    // before telling the user they're offline (and before clearing the banner).
    const probe = async () => {
      if (document.visibilityState === 'hidden') return; // don't burn requests in the background
      if (!navigator.onLine) { if (!cancelled) setOffline(true); return; }
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch('/api/tareeq/ping', { method: 'GET', cache: 'no-store', signal: ctrl.signal });
        clearTimeout(t);
        if (!cancelled) setOffline(!res.ok);
      } catch {
        if (!cancelled) setOffline(true);
      }
    };
    probe();
    const onOnline  = () => { probe(); };
    const onOffline = () => { if (!cancelled) setOffline(true); };
    const onVisible = () => { if (document.visibilityState === 'visible') probe(); };
    // A single probe on mount leaves the banner stuck in BOTH directions: one timed-out
    // probe pins "you're offline" on a perfectly online user for the whole session (the
    // `online` event only fires on a navigator.onLine false→true edge, which never
    // happens), and a captive portal that appears mid-session is never noticed. Re-probe
    // periodically and whenever the user comes back to the tab.
    const iv = setInterval(probe, 20_000);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold"
      style={{ background: '#92400e', color: '#fef3c7' }}
    >
      <span aria-hidden="true">📶</span>
      <span>
        {isRtl
          ? 'أنت غير متصل — تصفح المحتوى المحفوظ'
          : "You're offline — browsing cached content"}
      </span>
    </div>
  );
}
