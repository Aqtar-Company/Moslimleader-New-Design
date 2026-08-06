'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/context/LanguageContext';

export default function TareeqOfflineBanner() {
  const { isRtl } = useLang();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOnline  = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
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
