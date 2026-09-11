'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS, CATEGORY_ACCENT_HEX } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';

/**
 * The first minute.
 *
 * A new member used to land on a feed they followed nobody in, with nothing on the page
 * suggesting a single account — so the platform's own content was invisible to the person
 * most in need of seeing it. Two steps: pick what you care about, then follow the people
 * who write about it.
 *
 * Skippable at every step and never forced: an onboarding you cannot leave is a worse
 * first impression than an empty feed.
 */

type Suggested = { id: string; name: string; username: string | null; avatarUrl: string | null; postCount: number };

const CAT_KEYS = Object.keys(TAREEQ_CATEGORIES) as TareeqCategoryKey[];
const MAX_PICKS = 3;

export default function WelcomeClient() {
  const { lang, isRtl } = useLang();
  const isEn = lang === 'en';
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<TareeqCategoryKey[]>([]);
  const [people, setPeople] = useState<Suggested[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/tareeq/login');
  }, [authLoading, user, router]);

  function togglePick(k: TareeqCategoryKey) {
    setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : p.length >= MAX_PICKS ? p : [...p, k]));
  }

  const loadPeople = useCallback(async () => {
    setLoadingPeople(true);
    try {
      const qs = new URLSearchParams({ limit: '8' });
      if (picked.length) qs.set('categories', picked.join(','));
      const res = await fetch(`/api/tareeq/suggestions?${qs}`, { credentials: 'include' });
      const d = await res.json();
      setPeople(d.users ?? []);
    } catch {
      setPeople([]);
    } finally {
      setLoadingPeople(false);
    }
  }, [picked]);

  async function goToPeople() {
    setStep(2);
    await loadPeople();
  }

  async function follow(id: string) {
    setBusy(id);
    // Optimistic: the button is the whole interaction, and waiting on the network here
    // reads as a dead control.
    setFollowed(f => new Set(f).add(id));
    try {
      const res = await fetch(`/api/tareeq/follow/${id}`, { method: 'POST', credentials: 'include' });
      if (!res.ok) setFollowed(f => { const n = new Set(f); n.delete(id); return n; });
    } catch {
      setFollowed(f => { const n = new Set(f); n.delete(id); return n; });
    } finally {
      setBusy(null);
    }
  }

  const card: React.CSSProperties = {
    background: 'var(--tr-surface)',
    border: '1px solid var(--tr-border-subtle)',
  };

  return (
    <div className="min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto px-4 py-10">

        <div className="text-center mb-8">
          <p className="text-[11px] font-black mb-2" style={{ color: 'var(--tr-gold)', letterSpacing: '.1em' }}>
            {isEn ? `STEP ${step} OF 2` : `الخطوة ${step} من 2`}
          </p>
          <h1 className="font-black text-2xl mb-2" style={{ color: 'var(--tr-text-primary)' }}>
            {step === 1
              ? (isEn ? 'What matters to you?' : 'ما الذي يهمّك؟')
              : (isEn ? 'People who write about it' : 'من يكتب في ذلك')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--tr-text-secondary)' }}>
            {step === 1
              ? (isEn ? `Pick up to ${MAX_PICKS} — you can change this any time.` : `اختر ما يصل إلى ${MAX_PICKS} — ويمكنك تغييرها في أي وقت.`)
              : (isEn ? 'Follow a few, and your feed stops being empty.' : 'تابع بعضهم، ولن تبقى صفحتك فارغة.')}
          </p>
        </div>

        {step === 1 ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {CAT_KEYS.map(k => {
                const on = picked.includes(k);
                const accent = CATEGORY_ACCENT_HEX[k] ?? 'var(--tr-gold)';
                const atLimit = !on && picked.length >= MAX_PICKS;
                return (
                  <button
                    key={k}
                    onClick={() => togglePick(k)}
                    disabled={atLimit}
                    aria-pressed={on}
                    className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl text-start transition active:scale-[0.98]"
                    style={{
                      ...card,
                      borderColor: on ? accent : 'var(--tr-border-subtle)',
                      background: on ? `${accent}14` : 'var(--tr-surface)',
                      opacity: atLimit ? 0.45 : 1,
                    }}
                  >
                    <span className="text-lg leading-none">{CATEGORY_ICONS[k] ?? '★'}</span>
                    <span className="text-sm font-bold flex-1" style={{ color: 'var(--tr-text-primary)' }}>
                      {isEn ? TAREEQ_CATEGORIES[k].en : TAREEQ_CATEGORIES[k].ar}
                    </span>
                    {on && (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={goToPeople}
              className="w-full py-3.5 rounded-2xl font-black text-sm transition active:scale-[0.98]"
              style={{ background: 'var(--tr-gold)', color: '#080E1C' }}
            >
              {picked.length
                ? (isEn ? 'Next' : 'التالي')
                : (isEn ? 'Show me anyone' : 'أرِني أي أحد')}
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2 mb-6">
              {loadingPeople ? (
                <p className="text-sm text-center py-10" style={{ color: 'var(--tr-text-muted)' }}>
                  {isEn ? 'Loading...' : 'جاري التحميل...'}
                </p>
              ) : people.length === 0 ? (
                // A real state, not an error: on a young platform, or after picking a
                // category nobody has written in yet, there is genuinely nobody to show.
                <div className="text-center py-10 px-4 rounded-2xl" style={card}>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--tr-text-primary)' }}>
                    {isEn ? 'Nobody to suggest yet' : 'لا أحد لنقترحه بعد'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--tr-text-secondary)' }}>
                    {isEn ? 'Be the first to write here.' : 'كن أول من يكتب هنا.'}
                  </p>
                </div>
              ) : people.map(p => {
                const isFollowed = followed.has(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3.5 py-3 rounded-2xl" style={card}>
                    <Link href={`/tareeq/u/${p.id}`} className="shrink-0">
                      {p.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <span
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
                          style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}
                        >
                          {p.name.slice(0, 1)}
                        </span>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/tareeq/u/${p.id}`} className="block text-sm font-bold truncate" style={{ color: 'var(--tr-text-primary)', textDecoration: 'none' }}>
                        {p.name}
                      </Link>
                      <p className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>
                        {isEn ? `${p.postCount} marks` : `${p.postCount} علامة`}
                      </p>
                    </div>
                    <button
                      onClick={() => follow(p.id)}
                      disabled={isFollowed || busy === p.id}
                      className="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition active:scale-95"
                      style={{
                        background: isFollowed ? 'var(--tr-overlay)' : 'var(--tr-gold)',
                        color: isFollowed ? 'var(--tr-text-muted)' : '#080E1C',
                        border: isFollowed ? '1px solid var(--tr-border-subtle)' : 'none',
                      }}
                    >
                      {isFollowed ? (isEn ? 'Following' : 'تتابعه') : (isEn ? 'Follow' : 'متابعة')}
                    </button>
                  </div>
                );
              })}
            </div>

            <Link
              href="/tareeq"
              className="block w-full py-3.5 rounded-2xl font-black text-sm text-center transition active:scale-[0.98]"
              style={{ background: 'var(--tr-gold)', color: '#080E1C', textDecoration: 'none' }}
            >
              {followed.size
                ? (isEn ? `Go to my feed (${followed.size})` : `اذهب إلى صفحتي (${followed.size})`)
                : (isEn ? 'Go to my feed' : 'اذهب إلى صفحتي')}
            </Link>
          </>
        )}

        <Link
          href="/tareeq"
          className="block text-center text-xs font-semibold mt-4"
          style={{ color: 'var(--tr-text-muted)', textDecoration: 'none' }}
        >
          {isEn ? 'Skip for now' : 'تخطَّ الآن'}
        </Link>
      </div>
    </div>
  );
}
