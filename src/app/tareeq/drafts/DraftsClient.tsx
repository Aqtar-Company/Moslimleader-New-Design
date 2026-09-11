'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

/**
 * Drafts saved on the server.
 *
 * Without this page a draft would be write-only: saved, filtered out of every feed by
 * `isDraft`, and unreachable — which is worse than the single localStorage draft it
 * replaces.
 */

type Draft = {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  updatedAt: string;
};

export default function DraftsClient() {
  const { lang, isRtl } = useLang();
  const isEn = lang === 'en';
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/tareeq/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/tareeq/drafts', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setDrafts(d.drafts ?? []))
      .catch(() => setDrafts([]));
  }, [user]);

  async function publish(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/tareeq/drafts/${id}`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        // Straight to the published post: the point of pressing publish is to see it live.
        router.push(`/tareeq/${id}`);
        return;
      }
      setBusy(null);
    } catch {
      setBusy(null);
    }
  }

  async function discard(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/tareeq/drafts/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) setDrafts(d => (d ?? []).filter(x => x.id !== id));
    } catch { /* keep the row; the user can retry */ }
    setBusy(null);
    setConfirmId(null);
  }

  const card: React.CSSProperties = {
    background: 'var(--tr-surface)',
    border: '1px solid var(--tr-border-subtle)',
  };

  return (
    <div className="min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/tareeq"
          className="inline-flex items-center gap-1.5 text-xs font-semibold mb-5"
          style={{ color: 'var(--tr-text-muted)', textDecoration: 'none' }}
        >
          <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
          {isEn ? 'Tareeq' : 'طريق'}
        </Link>

        <h1 className="font-black text-2xl mb-1" style={{ color: 'var(--tr-text-primary)' }}>
          {isEn ? 'My drafts' : 'مسوداتي'}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--tr-text-secondary)' }}>
          {isEn
            ? 'Saved on the server, so they follow you between devices.'
            : 'محفوظة على السيرفر، فتتبعك بين أجهزتك.'}
        </p>

        {drafts === null ? (
          <p className="text-sm py-10 text-center" style={{ color: 'var(--tr-text-muted)' }}>
            {isEn ? 'Loading...' : 'جاري التحميل...'}
          </p>
        ) : drafts.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-2xl" style={card}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--tr-text-primary)' }}>
              {isEn ? 'No drafts' : 'لا مسودات'}
            </p>
            <p className="text-xs" style={{ color: 'var(--tr-text-secondary)' }}>
              {isEn ? 'Press "Save draft" in the composer to keep one here.' : 'اضغط «حفظ كمسودة» في المحرر ليُحفظ هنا.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {drafts.map(d => (
              <div key={d.id} className="rounded-2xl p-4" style={card}>
                <div className="flex items-start gap-3">
                  {d.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={d.imageUrl}
                      alt={d.imageAlt ?? ''}
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    {d.title && (
                      <p className="text-sm font-bold mb-0.5 truncate" style={{ color: 'var(--tr-text-primary)' }}>{d.title}</p>
                    )}
                    <p className="text-sm line-clamp-3" style={{ color: 'var(--tr-text-secondary)', whiteSpace: 'pre-wrap' }}>
                      {d.content.slice(0, 220) || (isEn ? '(no text)' : '(بلا نص)')}
                    </p>
                    <p className="text-[11px] mt-1.5" style={{ color: 'var(--tr-text-muted)' }}>
                      {new Date(d.updatedAt).toLocaleString(isEn ? 'en' : 'ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>

                {confirmId === d.id ? (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => discard(d.id)}
                      disabled={busy === d.id}
                      className="flex-1 py-2 rounded-xl text-xs font-black disabled:opacity-50"
                      style={{ background: '#f43f5e', color: '#fff' }}
                    >
                      {isEn ? 'Yes, discard' : 'نعم، احذفها'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold"
                      style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}
                    >
                      {isEn ? 'Keep it' : 'أبقِها'}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => publish(d.id)}
                      disabled={busy === d.id}
                      className="flex-1 py-2 rounded-xl text-xs font-black disabled:opacity-50"
                      style={{ background: 'var(--tr-gold)', color: '#080E1C' }}
                    >
                      {busy === d.id ? (isEn ? 'Publishing...' : 'جاري النشر...') : (isEn ? 'Publish' : 'انشر')}
                    </button>
                    <button
                      onClick={() => setConfirmId(d.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold"
                      style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-subtle)' }}
                    >
                      {isEn ? 'Discard' : 'حذف'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
