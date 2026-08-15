'use client';
import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';

type DataType = 'posts' | 'notes' | 'bookmarks' | 'comments';
type Range    = 'month' | '3months' | '6months' | 'year' | 'all' | 'custom';

const TYPE_LABELS: Record<DataType, { ar: string; en: string }> = {
  posts:     { ar: 'المنشورات',    en: 'Posts' },
  notes:     { ar: 'الملاحظات',    en: 'Notes' },
  bookmarks: { ar: 'المحفوظات',    en: 'Bookmarks' },
  comments:  { ar: 'التعليقات',    en: 'Comments' },
};

const RANGE_LABELS: Record<Range, { ar: string; en: string }> = {
  month:    { ar: 'آخر شهر',   en: 'Last month' },
  '3months':{ ar: 'آخر 3 أشهر', en: 'Last 3 months' },
  '6months':{ ar: 'آخر 6 أشهر', en: 'Last 6 months' },
  year:     { ar: 'آخر سنة',   en: 'Last year' },
  all:      { ar: 'جميع البيانات', en: 'All data' },
  custom:   { ar: 'تحديد التاريخ', en: 'Custom range' },
};

function rangeToParams(range: Range, customFrom: string, customTo: string): { from?: string; to?: string } {
  const now = new Date();
  if (range === 'all') return {};
  if (range === 'custom') {
    return { from: customFrom || undefined, to: customTo || undefined };
  }
  const months = range === 'month' ? 1 : range === '3months' ? 3 : range === '6months' ? 6 : 12;
  const from = new Date(now);
  from.setMonth(from.getMonth() - months);
  return { from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
}

type Status = 'idle' | 'downloading' | 'done' | 'error';

export default function TareeqExportClient() {
  const { isRtl } = useLang();

  const [types,       setTypes]       = useState<Set<DataType>>(new Set(['posts', 'notes', 'bookmarks', 'comments']));
  const [range,       setRange]       = useState<Range>('all');
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');
  const [status,      setStatus]      = useState<Status>('idle');

  function toggleType(t: DataType) {
    setTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  async function handleDownload() {
    if (types.size === 0) return;
    setStatus('downloading');
    try {
      const params = new URLSearchParams({ types: [...types].join(',') });
      const { from, to } = rangeToParams(range, customFrom, customTo);
      if (from) params.set('from', from);
      if (to)   params.set('to', to);

      const res = await fetch(`/api/tareeq/export?${params}`, { credentials: 'include' });
      if (!res.ok) { setStatus('error'); return; }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `tareeq-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  const inputStyle = {
    background: 'var(--tr-raised)',
    border: '1px solid var(--tr-border-soft)',
    color: 'var(--tr-text-primary)',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  } as const;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px 64px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </div>
        <div>
          <h1 className="font-black text-lg" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'تصدير بياناتي' : 'Export My Data'}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl ? 'احصل على نسخة من بياناتك بصيغة JSON' : 'Download a copy of your data as JSON'}
          </p>
        </div>
      </div>

      {/* Type selection */}
      <section className="mb-6">
        <p className="text-xs font-bold mb-3 uppercase tracking-wide" style={{ color: 'var(--tr-text-muted)' }}>
          {isRtl ? 'نوع البيانات' : 'Data type'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TYPE_LABELS) as DataType[]).map(t => {
            const on = types.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl transition text-start"
                style={{
                  background: on ? 'var(--tr-gold-glow)' : 'var(--tr-raised)',
                  border: on ? '1px solid var(--tr-gold-dim)' : '1px solid var(--tr-border-soft)',
                  color: on ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                  fontWeight: on ? 700 : 500,
                  fontSize: 14,
                }}
              >
                <span className="w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px]"
                  style={{ background: on ? 'var(--tr-gold)' : 'var(--tr-border-soft)', color: on ? '#fff' : 'transparent' }}>
                  {on ? '✓' : ''}
                </span>
                {isRtl ? TYPE_LABELS[t].ar : TYPE_LABELS[t].en}
              </button>
            );
          })}
        </div>
      </section>

      {/* Date range */}
      <section className="mb-6">
        <p className="text-xs font-bold mb-3 uppercase tracking-wide" style={{ color: 'var(--tr-text-muted)' }}>
          {isRtl ? 'الفترة الزمنية' : 'Time range'}
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
              style={{
                background: range === r ? 'var(--tr-gold-glow)' : 'var(--tr-raised)',
                border: range === r ? '1px solid var(--tr-gold-dim)' : '1px solid var(--tr-border-soft)',
                color: range === r ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
              }}
            >
              {isRtl ? RANGE_LABELS[r].ar : RANGE_LABELS[r].en}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'من' : 'From'}</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'إلى' : 'To'}</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={inputStyle} />
            </div>
          </div>
        )}
      </section>

      {/* Note for large exports */}
      <div className="flex gap-2 p-3 rounded-xl mb-6" style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="var(--tr-text-muted)" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--tr-text-muted)' }}>
          {isRtl
            ? 'ملف التصدير يتضمن النصوص والروابط فقط — الصور والفيديو تُحفظ بروابطها ولا تُرفق مباشرة.'
            : 'The export includes text and links only — images and videos are referenced by URL, not downloaded.'}
        </p>
      </div>

      {/* Status messages */}
      {status === 'done' && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
          <span>✓</span>
          <span className="text-sm font-semibold">{isRtl ? 'تم التنزيل بنجاح' : 'Downloaded successfully'}</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: '#f43f5e' }}>
          <span>✗</span>
          <span className="text-sm font-semibold">{isRtl ? 'حدث خطأ — جرّب مرة أخرى' : 'Something went wrong — try again'}</span>
        </div>
      )}

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={types.size === 0 || status === 'downloading'}
        className="w-full py-3.5 rounded-2xl font-bold text-sm transition active:scale-[0.98] flex items-center justify-center gap-2"
        style={{
          background: types.size === 0 || status === 'downloading' ? 'var(--tr-raised)' : 'var(--tr-gold)',
          color: types.size === 0 || status === 'downloading' ? 'var(--tr-text-muted)' : '#0a0d06',
          border: 'none',
          cursor: types.size === 0 || status === 'downloading' ? 'default' : 'pointer',
        }}
      >
        {status === 'downloading' ? (
          <>
            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            {isRtl ? 'جاري التجهيز...' : 'Preparing…'}
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {isRtl ? 'تنزيل النسخة الاحتياطية' : 'Download Backup'}
          </>
        )}
      </button>
    </div>
  );
}
