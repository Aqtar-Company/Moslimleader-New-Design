'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { BROADCAST_KINDS, type BroadcastKind } from '@/lib/admin-broadcast-shared';

/**
 * A slim strip under the header for the newest unread announcement or update from the
 * administration. One line, one link, one dismiss. It shows at most one message, never on
 * the notice pages themselves, and goes away the moment the message is opened or dismissed
 * (both mark it read server-side, so it stays gone on every device).
 *
 * Deliberately quiet: reminders and personal notes never take the banner — the API only
 * offers announcements and updates from the last 7 days.
 */
export default function TareeqNoticeBanner() {
  const { user } = useAuth();
  const { isRtl } = useLang();
  const pathname = usePathname();
  const [notice, setNotice] = useState<{ id: string; kind: string; title: string } | null>(null);
  const [hidden, setHidden] = useState(false);

  const onNoticePage = pathname === '/tareeq/notices' || pathname.startsWith('/tareeq/notices/');
  // The one immersive page — the nav hides there too.
  const immersive = pathname.startsWith('/tareeq/khatmati/read');

  useEffect(() => {
    if (!user || onNoticePage) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/tareeq/notices/latest');
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (!cancelled) { setNotice(d.notice ?? null); setHidden(false); }
      } catch { /* the banner is optional */ }
    };
    check();
    const t = setInterval(check, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user, onNoticePage]);

  if (!user || onNoticePage || immersive || hidden || !notice) return null;
  const k = BROADCAST_KINDS[notice.kind as BroadcastKind];

  const dismiss = () => {
    setHidden(true);
    void fetch(`/api/tareeq/notices/${notice.id}`, { method: 'POST' }).catch(() => {});
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="sticky top-0 z-50 flex items-center gap-2 px-3 py-2 text-sm"
      style={{ background: 'var(--tr-gold-glow)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--tr-gold-dim)', color: 'var(--tr-text-primary)' }}>
      <span aria-hidden className="shrink-0">{k?.icon ?? '📣'}</span>
      <Link href={`/tareeq/notices/${notice.id}`} className="flex-1 min-w-0 truncate font-bold hover:underline">
        {notice.title}
      </Link>
      <Link href={`/tareeq/notices/${notice.id}`} className="shrink-0 text-xs font-black px-3 py-1 rounded-full" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>
        {isRtl ? 'اقرأ' : 'Read'}
      </Link>
      <button type="button" onClick={dismiss} aria-label={isRtl ? 'إغلاق' : 'Dismiss'}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ color: 'var(--tr-text-muted)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
