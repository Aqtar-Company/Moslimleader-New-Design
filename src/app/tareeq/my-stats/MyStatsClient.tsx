'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

/**
 * The author's own numbers.
 *
 * Every one of these was already maintained on every post — views, reactions, comments,
 * saves, shares — and shown nowhere the writer could see them together. On a platform
 * built on written experience, the writer continuing IS the product, and nothing showed
 * them they had been read.
 */

type Totals = { posts: number; followers: number; views: number; reactions: number; comments: number; saves: number; shares: number };
type Row = { id: string; title: string; createdAt: string; viewCount: number; likeCount: number; commentCount: number; savedCount: number; shareCount: number };

export default function MyStatsClient() {
  const { lang, isRtl } = useLang();
  const isEn = lang === 'en';
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [totals, setTotals] = useState<Totals | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/tareeq/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/tareeq/my-stats', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setTotals(d.totals); setRows(d.posts ?? []); })
      .catch(() => setRows([]));
  }, [user]);

  const card: React.CSSProperties = { background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' };
  const num = (n: number) => n.toLocaleString(isEn ? 'en' : 'ar-EG');

  const tiles: { key: keyof Totals; ar: string; en: string }[] = [
    { key: 'views',     ar: 'مشاهدة',  en: 'Views' },
    { key: 'reactions', ar: 'تفاعل',   en: 'Reactions' },
    { key: 'comments',  ar: 'تعليق',   en: 'Comments' },
    { key: 'saves',     ar: 'حفظ',     en: 'Saves' },
    { key: 'shares',    ar: 'مشاركة',  en: 'Shares' },
    { key: 'followers', ar: 'متابع',   en: 'Followers' },
  ];

  return (
    <div className="min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/tareeq" className="inline-flex items-center gap-1.5 text-xs font-semibold mb-5"
          style={{ color: 'var(--tr-text-muted)', textDecoration: 'none' }}>
          <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
          {isEn ? 'Tareeq' : 'طريق'}
        </Link>

        <h1 className="font-black text-2xl mb-1" style={{ color: 'var(--tr-text-primary)' }}>
          {isEn ? 'The reach of my marks' : 'أثر علاماتي'}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--tr-text-secondary)' }}>
          {totals
            ? (isEn ? `Across ${num(totals.posts)} published marks.` : `على ${num(totals.posts)} علامة منشورة.`)
            : ' '}
        </p>

        {totals && (
          <div className="grid grid-cols-3 gap-2 mb-7">
            {tiles.map(t => (
              <div key={t.key} className="rounded-2xl px-3 py-3.5 text-center" style={card}>
                <p className="font-black text-xl leading-tight" style={{ color: 'var(--tr-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {num(totals[t.key])}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{isEn ? t.en : t.ar}</p>
              </div>
            ))}
          </div>
        )}

        <h2 className="font-bold text-sm mb-3" style={{ color: 'var(--tr-text-primary)' }}>
          {isEn ? 'Most read' : 'الأكثر قراءة'}
        </h2>

        {rows === null ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--tr-text-muted)' }}>
            {isEn ? 'Loading...' : 'جاري التحميل...'}
          </p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={card}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--tr-text-primary)' }}>
              {isEn ? 'Nothing published yet' : 'لا علامات منشورة بعد'}
            </p>
            <p className="text-xs" style={{ color: 'var(--tr-text-secondary)' }}>
              {isEn ? 'Your first mark will show its numbers here.' : 'أول علامة لك ستظهر أرقامها هنا.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map(r => (
              <Link
                key={r.id}
                href={`/tareeq/${r.id}`}
                className="block rounded-2xl px-4 py-3"
                style={{ ...card, textDecoration: 'none' }}
              >
                <p className="text-sm font-bold mb-1.5 line-clamp-2" style={{ color: 'var(--tr-text-primary)' }}>{r.title}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--tr-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  <span>{isEn ? `${num(r.viewCount)} views` : `${num(r.viewCount)} مشاهدة`}</span>
                  <span>{isEn ? `${num(r.likeCount)} reactions` : `${num(r.likeCount)} تفاعل`}</span>
                  <span>{isEn ? `${num(r.commentCount)} comments` : `${num(r.commentCount)} تعليق`}</span>
                  <span>{isEn ? `${num(r.savedCount)} saves` : `${num(r.savedCount)} حفظ`}</span>
                  <span>{isEn ? `${num(r.shareCount)} shares` : `${num(r.shareCount)} مشاركة`}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
