'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

/**
 * What happened to the account, and the member's one reply.
 *
 * A ban recorded a reason and an expiry that the banned member could not see, with no way
 * to answer. This page shows both and files a single appeal.
 */

type Ban = {
  id: string;
  type: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  appealText: string | null;
  appealedAt: string | null;
  appealStatus: string | null;
};

export default function AppealClient() {
  const { lang, isRtl } = useLang();
  const isEn = lang === 'en';

  const [ban, setBan] = useState<Ban | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch('/api/tareeq/appeal', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setBan(d.ban ?? null))
      .catch(() => setBan(null));
  }, []);

  async function submit() {
    setError('');
    if (text.trim().length < 10) {
      setError(isEn ? 'Please write at least 10 characters.' : 'اكتب 10 أحرف على الأقل.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/tareeq/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: text.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setSent(true);
      else setError(d.error || (isEn ? 'Something went wrong.' : 'حدث خطأ.'));
    } catch {
      setError(isEn ? 'No connection.' : 'لا يوجد اتصال.');
    } finally {
      setSending(false);
    }
  }

  const card: React.CSSProperties = { background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(isEn ? 'en' : 'ar-EG', { dateStyle: 'long' });

  return (
    <div className="min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto px-4 py-10">
        <h1 className="font-black text-2xl mb-6" style={{ color: 'var(--tr-text-primary)' }}>
          {isEn ? 'Account status' : 'حالة الحساب'}
        </h1>

        {ban === undefined ? (
          <p className="text-sm py-10 text-center" style={{ color: 'var(--tr-text-muted)' }}>
            {isEn ? 'Loading...' : 'جاري التحميل...'}
          </p>
        ) : ban === null ? (
          <div className="rounded-2xl p-6 text-center" style={card}>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--tr-text-primary)' }}>
              {isEn ? 'Your account is in good standing' : 'حسابك سليم'}
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--tr-text-secondary)' }}>
              {isEn ? 'There are no restrictions on it.' : 'لا توجد أي قيود عليه.'}
            </p>
            <Link href="/tareeq" className="text-xs font-black" style={{ color: 'var(--tr-gold)' }}>
              {isEn ? 'Back to Tareeq' : 'رجوع إلى طريق'}
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl p-5 mb-4" style={{ ...card, borderColor: '#f43f5e55' }}>
              <p className="text-[11px] font-black mb-2" style={{ color: '#f43f5e', letterSpacing: '.08em' }}>
                {isEn ? 'RESTRICTION' : 'قيد على الحساب'}
              </p>
              <p className="text-sm font-bold mb-3" style={{ color: 'var(--tr-text-primary)' }}>
                {isEn ? 'The reason given' : 'السبب المذكور'}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--tr-text-secondary)', whiteSpace: 'pre-wrap' }}>
                {ban.reason}
              </p>
              <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--tr-text-muted)' }}>
                <span>{isEn ? `Applied ${fmt(ban.createdAt)}` : `بدأ في ${fmt(ban.createdAt)}`}</span>
                <span>
                  {ban.expiresAt
                    ? (isEn ? `Ends ${fmt(ban.expiresAt)}` : `ينتهي في ${fmt(ban.expiresAt)}`)
                    : (isEn ? 'No end date' : 'بلا تاريخ انتهاء')}
                </span>
              </div>
            </div>

            {sent || ban.appealStatus ? (
              <div className="rounded-2xl p-5" style={card}>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--tr-text-primary)' }}>
                  {ban.appealStatus === 'rejected'
                    ? (isEn ? 'Your appeal was reviewed and declined' : 'تمّت مراجعة تظلّمك ورُفض')
                    : ban.appealStatus === 'accepted'
                    ? (isEn ? 'Your appeal was accepted' : 'تمّ قبول تظلّمك')
                    : (isEn ? 'Your appeal is with the moderators' : 'تظلّمك عند الإشراف')}
                </p>
                <p className="text-xs" style={{ color: 'var(--tr-text-secondary)' }}>
                  {ban.appealStatus === 'accepted'
                    ? (isEn ? 'The restriction will be lifted.' : 'سيُرفع القيد عن حسابك.')
                    : ban.appealStatus === 'rejected'
                    ? (isEn ? 'The restriction stands.' : 'القيد باقٍ كما هو.')
                    : (isEn ? 'One appeal per restriction. You will be told the outcome.' : 'تظلّم واحد لكل قيد. وستُخبر بالنتيجة.')}
                </p>
                {(ban.appealText || text) && (
                  <p className="text-xs mt-3 pt-3" style={{ color: 'var(--tr-text-muted)', borderTop: '1px solid var(--tr-border-subtle)', whiteSpace: 'pre-wrap' }}>
                    {ban.appealText || text}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl p-5" style={card}>
                <label htmlFor="appeal-text" className="block text-sm font-bold mb-1" style={{ color: 'var(--tr-text-primary)' }}>
                  {isEn ? 'Your reply' : 'ردّك'}
                </label>
                <p className="text-xs mb-3" style={{ color: 'var(--tr-text-secondary)' }}>
                  {isEn
                    ? 'One appeal per restriction, so say what matters.'
                    : 'تظلّم واحد لكل قيد، فاكتب ما يهم.'}
                </p>
                <textarea
                  id="appeal-text"
                  value={text}
                  onChange={e => setText(e.target.value.slice(0, 1200))}
                  rows={6}
                  maxLength={1200}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y"
                  style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-primary)', border: '1px solid var(--tr-border-subtle)' }}
                  placeholder={isEn ? 'Explain what you think happened.' : 'اشرح ما تراه حدث.'}
                />
                <div className="flex items-center justify-between mt-1 mb-3">
                  <span className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>{text.length} / 1200</span>
                  {error && <span className="text-[11px] font-semibold" style={{ color: '#f43f5e' }}>{error}</span>}
                </div>
                <button
                  onClick={submit}
                  disabled={sending}
                  className="w-full py-3 rounded-xl text-sm font-black disabled:opacity-50"
                  style={{ background: 'var(--tr-gold)', color: '#080E1C' }}
                >
                  {sending ? (isEn ? 'Sending...' : 'جاري الإرسال...') : (isEn ? 'Send appeal' : 'أرسل التظلّم')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
