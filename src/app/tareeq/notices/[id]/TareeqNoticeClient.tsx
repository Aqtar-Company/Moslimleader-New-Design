'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import { formatNoticeDate, noticeKind, type Notice } from '../TareeqNoticesClient';

/**
 * One message from the administration, in full. Opening it is what marks it read (the API
 * does that on GET), so the bell badge and the banner clear as soon as the page loads.
 */
export default function TareeqNoticeClient({ id }: { id: string }) {
  const { isRtl } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const { refresh } = useTareeqNotifications();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(`/tareeq/login?redirect=/tareeq/notices/${id}`); return; }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/tareeq/notices/${id}`);
      if (cancelled) return;
      if (!res.ok) { setState('missing'); return; }
      const d = await res.json();
      setNotice(d.notice);
      setState('ok');
      refresh(); // the badge counted this one until now
    })();
    return () => { cancelled = true; };
  }, [id, user, authLoading, router, refresh]);

  const k = notice ? noticeKind(notice.kind) : null;
  const linkIsInternal = !!notice?.linkUrl && notice.linkUrl.startsWith('/');

  return (
    <div className="max-w-[680px] mx-auto pb-16">
      <div className="sticky top-0 z-10" style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/tareeq/notices"
            className="flex items-center justify-center w-8 h-8 rounded-full transition shrink-0"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}
            aria-label={isRtl ? 'رجوع' : 'Back'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ transform: isRtl ? 'none' : 'scaleX(-1)' }}><path d="M9 6l6 6-6 6" /></svg>
          </Link>
          <h1 className="font-black text-lg truncate" style={{ color: 'var(--tr-text-primary)' }}>
            {k ? (isRtl ? k.ar : k.en) : (isRtl ? 'رسالة من الإدارة' : 'Message from the team')}
          </h1>
        </div>
      </div>

      <div className="px-4 py-4">
        {state === 'loading' && (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        )}
        {state === 'missing' && (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-bold" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'هذه الرسالة غير متاحة' : 'This message is not available'}</p>
            <Link href="/tareeq/notices" className="inline-block mt-4 text-sm font-bold" style={{ color: 'var(--tr-gold)' }}>{isRtl ? 'كل الرسائل' : 'All messages'}</Link>
          </div>
        )}
        {state === 'ok' && notice && k && (
          <article className="rounded-3xl p-5 sm:p-7" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)', boxShadow: 'var(--tr-shadow-card)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl leading-none" aria-hidden>{k.icon}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}>{isRtl ? k.ar : k.en}</span>
              <span className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>{formatNoticeDate(notice.startedAt ?? notice.createdAt, isRtl)}</span>
            </div>
            <h2 className="font-black text-2xl mt-3 leading-snug" style={{ color: 'var(--tr-text-primary)', textWrap: 'balance' }}>{notice.title}</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--tr-text-muted)' }}>{notice.createdByName || (isRtl ? 'إدارة طريق' : 'Tareeq team')}</p>
            <div className="mt-5 text-[15px] leading-8" style={{ color: 'var(--tr-text-secondary)', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
              {notice.body}
            </div>
            {notice.linkUrl && (
              linkIsInternal ? (
                <Link href={notice.linkUrl} className="inline-block mt-6 px-5 py-3 rounded-2xl font-black text-sm" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>
                  {notice.linkLabel || (isRtl ? 'افتح الرابط' : 'Open link')}
                </Link>
              ) : (
                <a href={notice.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-6 px-5 py-3 rounded-2xl font-black text-sm" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>
                  {notice.linkLabel || (isRtl ? 'افتح الرابط' : 'Open link')} ↗
                </a>
              )
            )}
          </article>
        )}
      </div>
    </div>
  );
}
