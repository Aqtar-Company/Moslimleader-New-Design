'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { SURAH_NAMES_AR, SURAH_NAMES_EN, TOTAL_QURAN_PAGES } from '@/lib/quran-data';

interface Progress {
  currentPage: number; currentSurah: number; currentAyah: number;
  lastReadDate: string | null; sirajStreak: number; totalPagesRead: number;
}

function sirajState(lastReadDate: string | null): 'bright' | 'dim' | 'dark' {
  if (!lastReadDate) return 'dark';
  const today = new Date().toISOString().slice(0, 10);
  if (lastReadDate === today) return 'bright';
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastReadDate === yesterday) return 'dim';
  return 'dark';
}

export default function KhatmatiHome({ initialProgress }: { initialProgress: Progress | null }) {
  const { isRtl } = useLang();
  const { user } = useAuth();

  const p = initialProgress;
  const state = sirajState(p?.lastReadDate ?? null);
  const page = p?.currentPage ?? 1;
  const pct = Math.round((page / TOTAL_QURAN_PAGES) * 100);
  const surahNameAr = SURAH_NAMES_AR[(p?.currentSurah ?? 1) - 1];
  const surahNameEn = SURAH_NAMES_EN[(p?.currentSurah ?? 1) - 1];

  const flameColor = state === 'bright' ? '#f4c55a' : state === 'dim' ? '#a07830' : '#555';
  const glowFilter = state === 'bright'
    ? 'drop-shadow(0 0 14px rgba(244,197,90,0.85)) drop-shadow(0 0 36px rgba(244,130,30,0.4))'
    : 'none';

  return (
    <>
      <style>{`
        @keyframes kh-pulse { 0%,100%{opacity:.85;transform:scale(1)} 50%{opacity:1;transform:scale(1.07)} }
        @keyframes kh-flicker {
          0%,100%{transform:scaleX(1) scaleY(1)}
          20%{transform:scaleX(.96) scaleY(1.04)}
          50%{transform:scaleX(1.04) scaleY(.97)}
          80%{transform:scaleX(.98) scaleY(1.03)}
        }
      `}</style>

      <div className="max-w-md mx-auto px-4 pt-8 pb-28" dir={isRtl ? 'rtl' : 'ltr'}>

        {/* ── Siraj ── */}
        <div className="flex flex-col items-center gap-5 mb-10">
          <div style={{ position: 'relative', width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {state === 'bright' && (
              <div style={{
                position: 'absolute', inset: -20, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(244,197,90,0.28) 0%, transparent 70%)',
                animation: 'kh-pulse 2.8s ease-in-out infinite',
              }} />
            )}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3}
              style={{
                width: 110, height: 110, color: flameColor,
                filter: glowFilter, transition: 'all 0.6s ease',
                animation: state === 'bright' ? 'kh-flicker 3.2s ease-in-out infinite' : 'none',
              }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z"/>
            </svg>
          </div>

          <div style={{ textAlign: 'center' }}>
            {state === 'bright' && (p?.sirajStreak ?? 0) > 1 ? (
              <p className="font-black text-lg" style={{ color: 'var(--tr-gold)' }}>
                {isRtl ? `نورك مستمر منذ ${p!.sirajStreak} أيام` : `${p!.sirajStreak} days of light`}
              </p>
            ) : state === 'bright' ? (
              <p className="font-bold text-base" style={{ color: 'var(--tr-gold)' }}>
                {isRtl ? 'أتممت وردك اليوم بحمد الله 🌿' : 'Today\'s wird completed 🌿'}
              </p>
            ) : state === 'dim' ? (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--tr-text-muted)', maxWidth: 240 }}>
                {isRtl ? 'خَفَت السراج بالأمس… أعد إليه النور اليوم' : 'The light dimmed yesterday — rekindle it today'}
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'أضئ سراجك — ابدأ ختمتك' : 'Light your siraj — begin your khatma'}
              </p>
            )}
          </div>
        </div>

        {/* ── Progress card ── */}
        {p && (
          <div className="rounded-3xl p-5 mb-5" style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? `صفحة ${page} من ${TOTAL_QURAN_PAGES}` : `Page ${page} of ${TOTAL_QURAN_PAGES}`}
              </span>
              <span className="text-xs font-black" style={{ color: 'var(--tr-gold)' }}>{pct}%</span>
            </div>
            <div className="rounded-full overflow-hidden mb-3" style={{ height: 5, background: 'var(--tr-overlay)' }} dir="ltr">
              <div style={{
                height: '100%', borderRadius: 999, transition: 'width 0.6s ease',
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #d4a853 0%, #f4c55a 100%)',
              }} />
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl
                ? `${surahNameAr} — الآية ${p.currentAyah}`
                : `${surahNameEn} — Ayah ${p.currentAyah}`}
            </p>
            {p.totalPagesRead > 0 && (
              <p className="text-[11px] text-center mt-1" style={{ color: 'var(--tr-text-muted)', opacity: 0.6 }}>
                {isRtl ? `${p.totalPagesRead} صفحة مقروءة` : `${p.totalPagesRead} pages read`}
              </p>
            )}
          </div>
        )}

        {/* ── CTA ── */}
        {user ? (
          <Link
            href={`/tareeq/khatmati/read?page=${page}&surah=${p?.currentSurah ?? 1}&ayah=${p?.currentAyah ?? 1}`}
            className="flex items-center justify-center gap-2 w-full font-black py-4 rounded-2xl transition active:scale-[0.98] text-[15px]"
            style={{ background: 'var(--tr-gold)', color: '#0a0c14', letterSpacing: '0.02em' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M5 12h14M12 5l7 7-7 7' : 'M19 12H5M12 19l-7-7 7-7'} />
            </svg>
            {p
              ? (isRtl ? `أكمل ختمتك — صفحة ${page}` : `Continue — Page ${page}`)
              : (isRtl ? 'ابدأ ختمتك الآن' : 'Start Your Khatma')}
          </Link>
        ) : (
          <Link
            href="/login?next=/tareeq/khatmati"
            className="block w-full text-center font-bold py-4 rounded-2xl"
            style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-primary)', border: '1px solid var(--tr-border-soft)' }}
          >
            {isRtl ? 'سجّل دخولك للبدء' : 'Login to Begin'}
          </Link>
        )}

        {/* ── Mode hint ── */}
        <p className="text-center text-xs mt-5" style={{ color: 'var(--tr-text-muted)', opacity: 0.5 }}>
          {isRtl ? 'استماع · مصحف · استماع + مصحف' : 'Listen · Read · Listen + Read'}
        </p>
      </div>
    </>
  );
}
