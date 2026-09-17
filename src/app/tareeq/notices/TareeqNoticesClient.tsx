'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { BROADCAST_KINDS, type BroadcastKind } from '@/lib/admin-broadcast-shared';

/**
 * "الإعلانات والتحديثات" — every message the administration sent to this member, newest
 * first, unread ones marked. The bell shows each one once; this page is where they stay.
 */

export interface Notice {
  id: string;
  kind: BroadcastKind | string;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  createdByName: string | null;
  startedAt: string | null;
  createdAt: string;
  receivedAt: string;
  readAt: string | null;
}

export function noticeKind(kind: string) {
  return BROADCAST_KINDS[kind as BroadcastKind] ?? { ar: 'رسالة', en: 'Message', icon: '📣' };
}

export function formatNoticeDate(iso: string, isRtl: boolean): string {
  try {
    return new Date(iso).toLocaleDateString(isRtl ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function TareeqNoticesClient() {
  const { isRtl } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);

  const load = useCallback(async (from?: string | null) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tareeq/notices?limit=20${from ? `&cursor=${from}` : ''}`);
      if (!res.ok) return;
      const d = await res.json();
      setNotices(prev => (from ? [...prev, ...d.notices] : d.notices));
      setCursor(d.nextCursor);
    } finally {
      setLoading(false);
      setMore(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/tareeq/login?redirect=/tareeq/notices'); return; }
    load();
  }, [user, authLoading, router, load]);

  return (
    <div className="max-w-[680px] mx-auto pb-16">
      <div className="sticky top-0 z-10" style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/tareeq/notifications"
            className="flex items-center justify-center w-8 h-8 rounded-full transition shrink-0"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}
            aria-label={isRtl ? 'رجوع' : 'Back'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ transform: isRtl ? 'none' : 'scaleX(-1)' }}><path d="M9 6l6 6-6 6" /></svg>
          </Link>
          <h1 className="font-black text-lg" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'الإعلانات والتحديثات' : 'Announcements & updates'}</h1>
        </div>
      </div>

      <div className="px-4 py-3">
        {loading && notices.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📣</div>
            <p className="font-bold" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'لا توجد رسائل من الإدارة بعد' : 'No messages from the team yet'}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'التحديثات والإعلانات المهمة ستظهر هنا' : 'Important updates and announcements will appear here'}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {notices.map(n => {
              const k = noticeKind(n.kind);
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <Link href={`/tareeq/notices/${n.id}`}
                    className="block rounded-2xl p-4 transition"
                    style={{
                      background: unread ? 'var(--tr-gold-glow)' : 'var(--tr-surface)',
                      border: `1px solid ${unread ? 'var(--tr-gold-dim)' : 'var(--tr-border-subtle)'}`,
                    }}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none mt-0.5" aria-hidden>{k.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)' }}>{isRtl ? k.ar : k.en}</span>
                          <span className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>{formatNoticeDate(n.receivedAt, isRtl)}</span>
                          {unread && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--tr-gold)' }} aria-label={isRtl ? 'غير مقروء' : 'Unread'} />}
                        </div>
                        <h2 className="font-black mt-1 leading-snug" style={{ color: 'var(--tr-text-primary)' }}>{n.title}</h2>
                        <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--tr-text-secondary)', whiteSpace: 'pre-line' }}>{n.body}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {cursor && (
          <button type="button" disabled={more} onClick={() => { setMore(true); load(cursor); }}
            className="w-full mt-4 py-3 rounded-2xl font-bold text-sm"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}>
            {more ? (isRtl ? 'جارٍ التحميل…' : 'Loading…') : (isRtl ? 'عرض الأقدم' : 'Show older')}
          </button>
        )}
      </div>
    </div>
  );
}
