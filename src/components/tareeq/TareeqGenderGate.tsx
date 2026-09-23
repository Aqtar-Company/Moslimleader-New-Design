'use client';

/**
 * The profile step طريق asks for once: country, year of birth, and whether the member is a
 * man or a woman.
 *
 * ## What is deliberately NOT here
 *
 * No explanation of what the answer does. The platform's modesty defaults — a woman's
 * pictures softened for a man, a question before a message crosses — are طريق's own
 * conduct, a floor for the case where someone does not keep it themselves. They are not a
 * guarantee offered to anyone, and saying «صورتك تظهر مشوّشة» would be a claim about a CSS
 * filter that anybody's developer tools defeat. A promise we cannot keep is worse than no
 * promise, because a woman decides what to upload on the strength of it.
 *
 * So the screen reads as what it is: a short profile form. The earlier version led with
 * «طريق تراعي الحشمة…» and listed the consequences underneath, which made one ordinary
 * field look like an interrogation, and committed us to things the code does not enforce.
 *
 * ## Why it still blocks
 *
 * The gender is the one field the defaults cannot work without: a member with no answer
 * cannot be placed on either side of them. Guessing was refused — a wrong guess either
 * softens a man's picture, which is merely odd, or leaves a woman's plain, which is the
 * thing being avoided, and nothing in the data tells them apart. Country and year are
 * optional and skip freely.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { TAREEQ_GENDERS, type TareeqGender } from '@/lib/tareeq-gender';

/** The countries most members are in, then the rest of the Arab world, then an escape. */
const COUNTRIES: { code: string; ar: string; en: string }[] = [
  { code: 'EG', ar: 'مصر', en: 'Egypt' },
  { code: 'SA', ar: 'السعودية', en: 'Saudi Arabia' },
  { code: 'AE', ar: 'الإمارات', en: 'UAE' },
  { code: 'KW', ar: 'الكويت', en: 'Kuwait' },
  { code: 'QA', ar: 'قطر', en: 'Qatar' },
  { code: 'BH', ar: 'البحرين', en: 'Bahrain' },
  { code: 'OM', ar: 'عُمان', en: 'Oman' },
  { code: 'JO', ar: 'الأردن', en: 'Jordan' },
  { code: 'PS', ar: 'فلسطين', en: 'Palestine' },
  { code: 'SY', ar: 'سوريا', en: 'Syria' },
  { code: 'LB', ar: 'لبنان', en: 'Lebanon' },
  { code: 'IQ', ar: 'العراق', en: 'Iraq' },
  { code: 'YE', ar: 'اليمن', en: 'Yemen' },
  { code: 'SD', ar: 'السودان', en: 'Sudan' },
  { code: 'LY', ar: 'ليبيا', en: 'Libya' },
  { code: 'TN', ar: 'تونس', en: 'Tunisia' },
  { code: 'DZ', ar: 'الجزائر', en: 'Algeria' },
  { code: 'MA', ar: 'المغرب', en: 'Morocco' },
  { code: 'TR', ar: 'تركيا', en: 'Türkiye' },
  { code: 'GB', ar: 'بريطانيا', en: 'United Kingdom' },
  { code: 'US', ar: 'الولايات المتحدة', en: 'United States' },
  { code: 'CA', ar: 'كندا', en: 'Canada' },
  { code: 'DE', ar: 'ألمانيا', en: 'Germany' },
  { code: 'FR', ar: 'فرنسا', en: 'France' },
  { code: 'ZZ', ar: 'دولة أخرى', en: 'Somewhere else' },
];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 74 }, (_, i) => THIS_YEAR - 7 - i); // 7 … 80 years old

export default function TareeqGenderGate() {
  const { user } = useAuth();
  const { lang } = useLang();
  const isRtl = lang !== 'en';

  const [needed, setNeeded] = useState<boolean | null>(null);
  const [gender, setGender] = useState<TareeqGender | ''>('');
  const [country, setCountry] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { setNeeded(false); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Retry rather than open. Opening on failure let a member browse طريق with no answer
    // stored, which no server route requires, so they could stay that way indefinitely.
    const check = (attempt = 0) => {
      fetch('/api/tareeq/gender', { credentials: 'include' })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(d => {
          if (cancelled) return;
          setNeeded(!d?.gender);
          if (d?.country) setCountry(d.country);
          if (d?.birthYear) setBirthYear(String(d.birthYear));
        })
        .catch(() => {
          if (cancelled || attempt >= 4) return;
          timer = setTimeout(() => check(attempt + 1), Math.min(8000, 1000 * 2 ** attempt));
        });
    };
    check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [user]);

  if (!needed) return null;

  async function save() {
    if (!gender || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/tareeq/gender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gender,
          country: country && country !== 'ZZ' ? country : undefined,
          birthYear: birthYear ? Number(birthYear) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'تعذّر الحفظ');
      // Reload rather than flip a flag: what is already on screen was rendered before the
      // answer existed.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الحفظ، حاول مرة أخرى');
      setSaving(false);
    }
  }

  const field: React.CSSProperties = {
    width: '100%', borderRadius: 14, padding: '11px 14px', fontSize: 14,
    background: 'var(--tr-overlay)', color: 'var(--tr-text-primary)',
    border: '1px solid var(--tr-border-soft)', outline: 'none', appearance: 'none',
    // `appearance: none` removes the native arrow; without drawing one back the control
    // reads as an inert box and nobody taps it.
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='%23999' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: isRtl ? 'left 14px center' : 'right 14px center',
    paddingInlineEnd: 34,
  };
  const label: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: 'var(--tr-text-muted)', marginBottom: 6, display: 'block',
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[300] flex items-center justify-center p-5 overflow-y-auto"
      style={{ background: 'rgba(8,10,16,0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 my-auto"
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        <h2 className="text-lg font-black mb-1" style={{ color: 'var(--tr-text-primary)' }}>
          {isRtl ? 'أكمل بياناتك' : 'Complete your profile'}
        </h2>
        <p className="text-[13px] mb-5" style={{ color: 'var(--tr-text-muted)' }}>
          {isRtl ? 'مرة واحدة، ويمكنك تعديلها لاحقاً من إعدادات ملفك.' : 'Once — you can change it later in your profile settings.'}
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <span style={label}>{isRtl ? 'الدولة' : 'Country'}</span>
            <select value={country} onChange={e => setCountry(e.target.value)} style={field}>
              <option value="">{isRtl ? '— اختياري —' : '— optional —'}</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{isRtl ? c.ar : c.en}</option>
              ))}
            </select>
          </div>

          <div>
            <span style={label}>{isRtl ? 'سنة الميلاد' : 'Year of birth'}</span>
            <select value={birthYear} onChange={e => setBirthYear(e.target.value)} style={field}>
              <option value="">{isRtl ? '— اختياري —' : '— optional —'}</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <span style={label}>{isRtl ? 'أنا' : 'I am'}</span>
            <div className="grid grid-cols-2 gap-2">
              {TAREEQ_GENDERS.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGender(g.value)}
                  className="rounded-2xl py-3 text-sm font-bold transition active:scale-95"
                  style={{
                    background: gender === g.value ? 'var(--tr-gold)' : 'var(--tr-overlay)',
                    color: gender === g.value ? '#1a1a1a' : 'var(--tr-text-primary)',
                    border: `1px solid ${gender === g.value ? 'var(--tr-gold)' : 'var(--tr-border-soft)'}`,
                  }}
                >
                  {isRtl ? g.labelAr : g.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs font-bold mt-4" style={{ color: '#f87171' }}>{error}</p>}

        <button
          type="button"
          disabled={!gender || saving}
          onClick={save}
          className="w-full rounded-2xl py-3 mt-6 font-black transition active:scale-95"
          style={{
            background: 'var(--tr-gold)', color: '#1a1a1a', border: 'none',
            opacity: !gender || saving ? 0.5 : 1, cursor: !gender || saving ? 'default' : 'pointer',
          }}
        >
          {saving ? (isRtl ? 'جارٍ الحفظ…' : 'Saving…') : (isRtl ? 'متابعة' : 'Continue')}
        </button>
      </div>
    </div>
  );
}
