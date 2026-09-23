'use client';

/**
 * The one question طريق asks before it opens.
 *
 * Every modesty and messaging rule reads `User.tareeqGender`, so a member with no answer
 * cannot be placed on either side of any of them. Guessing was considered and refused: a
 * wrong guess either veils a man's picture (merely odd) or exposes a woman's (the thing
 * the feature exists to prevent), and no signal in the data distinguishes the two.
 *
 * So the gate BLOCKS. It covers the screen, it has no dismiss, and it does not close until
 * the server has stored an answer. About 2000 accounts predate the field and will meet it
 * on their next visit — abrupt, and chosen with that known.
 *
 * It renders only for a signed-in member whose gender is unset. A signed-out visitor sees
 * nothing (they have their own sign-in wall), and a member who has answered never sees it
 * again.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { TAREEQ_GENDERS, type TareeqGender } from '@/lib/tareeq-gender';

export default function TareeqGenderGate() {
  const { user } = useAuth();
  const { lang } = useLang();
  const isRtl = lang !== 'en';
  const [needed, setNeeded] = useState<boolean | null>(null);
  const [saving, setSaving] = useState<TareeqGender | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { setNeeded(false); return; }
    let cancelled = false;
    fetch('/api/tareeq/gender', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setNeeded(!!d && !d.gender); })
      // A failed check must not lock someone out of طريق over a network blip.
      .catch(() => { if (!cancelled) setNeeded(false); });
    return () => { cancelled = true; };
  }, [user]);

  if (!needed) return null;

  async function choose(gender: TareeqGender) {
    setSaving(gender);
    setError('');
    try {
      const res = await fetch('/api/tareeq/gender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gender }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'تعذّر الحفظ');
      // Reload rather than flip a flag: avatars already on screen were rendered without
      // knowing the viewer's gender, and a woman's picture must not sit unblurred behind
      // a gate that has just closed.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الحفظ، حاول مرة أخرى');
      setSaving(null);
    }
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[300] flex items-center justify-center p-5"
      style={{ background: 'rgba(8,10,16,0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-7 text-center"
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        <div className="text-4xl mb-3" aria-hidden>🕊️</div>
        <h2 className="text-xl font-black mb-2" style={{ color: 'var(--tr-text-primary)' }}>
          {isRtl ? 'قبل أن تدخل طريق' : 'Before you enter Tareeq'}
        </h2>
        <p className="text-sm leading-relaxed mb-1" style={{ color: 'var(--tr-text-secondary)' }}>
          {isRtl
            ? 'طريق تراعي الحشمة بين الرجال والنساء، وهذا يحتاج أن نعرف منك واحدة.'
            : 'Tareeq keeps a measure of modesty between men and women, and that needs one answer from you.'}
        </p>
        <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--tr-text-muted)' }}>
          {isRtl
            ? 'يمكنك تغييرها لاحقاً من الإعدادات.'
            : 'You can change it later in settings.'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {TAREEQ_GENDERS.map(g => (
            <button
              key={g.value}
              type="button"
              disabled={saving !== null}
              onClick={() => choose(g.value)}
              className="rounded-2xl py-5 font-bold transition active:scale-95"
              style={{
                background: saving === g.value ? 'var(--tr-gold)' : 'var(--tr-overlay)',
                color: saving === g.value ? '#1a1a1a' : 'var(--tr-text-primary)',
                border: '1px solid var(--tr-border-soft)',
                opacity: saving && saving !== g.value ? 0.5 : 1,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              <span className="block text-2xl mb-1" aria-hidden>{g.value === 'male' ? '👤' : '🧕'}</span>
              {isRtl ? g.labelAr : g.labelEn}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-xs font-bold mt-4" style={{ color: '#f87171' }}>{error}</p>
        )}

        <p className="text-[11px] leading-relaxed mt-6" style={{ color: 'var(--tr-text-muted)' }}>
          {isRtl
            ? 'ما الذي يتغيّر: صور النساء تظهر مشوّشة للرجال، ورسالة بين رجل وامرأة تُسبق بسؤال عن صلة القرابة. ولا شيء غير ذلك.'
            : 'What changes: women’s photos appear blurred to men, and a message between a man and a woman is preceded by a question about kinship. Nothing else.'}
        </p>
      </div>
    </div>
  );
}
