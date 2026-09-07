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
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
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
