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
  const today = new Date().toLocaleDateString('en-CA');
  if (lastReadDate === today) return 'bright';
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = d.toLocaleDateString('en-CA');
  if (lastReadDate === yesterday) return 'dim';
  return 'dark';
}

export default function KhatmatiHome({ initialProgress }: { initialProgress: Progress | null }) {
  const { isRtl } = useLang();
  const { user } = useAuth();

  const p = initialProgress;

  // Seed localStorage so bottom nav can quick-resume without API call
  if (typeof window !== 'undefined' && p) {
    localStorage.setItem('nuri-progress', JSON.stringify({
      page: p.currentPage, surah: p.currentSurah, ayah: p.currentAyah,
    }));
  }
  const state = sirajState(p?.lastReadDate ?? null);
  const page = p?.currentPage ?? 1;
  const pct = Math.round((page / TOTAL_QURAN_PAGES) * 100);
  const surahNameAr = SURAH_NAMES_AR[(p?.currentSurah ?? 1) - 1];
  const surahNameEn = SURAH_NAMES_EN[(p?.currentSurah ?? 1) - 1];

  // Lantern level: 0–4 based on streak + whether today was read
  // dim state = missed today → show one level below current streak
  const streak = p?.sirajStreak ?? 0;
  const lanternLevel = state === 'dark' ? 0
    : state === 'dim' ? Math.max(0, Math.min(streak - 1, 4))
    : Math.min(streak, 4);

  return (
    <>
      <style>{`
        @keyframes kh-pulse { 0%,100%{opacity:.9;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
      `}</style>

      <div className="max-w-md mx-auto px-4 pt-8 pb-10" dir={isRtl ? 'rtl' : 'ltr'}>

        {/* ── Page title ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-black text-2xl" style={{ color: 'var(--nuri-gold)', letterSpacing: '-0.01em' }}>
              نُوري
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'ختمتك القرآنية' : 'Your Quran journey'}
            </p>
          </div>
          {p && (
            <span className="text-xs font-black px-2.5 py-1 rounded-full"
              style={{ background: 'var(--nuri-gold-glow)', color: 'var(--nuri-gold)', border: '1px solid rgba(212,168,83,0.3)' }}>
              {pct}%
            </span>
          )}
        </div>

        {/* ── Siraj lantern image ── */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div style={{ position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {state === 'bright' && (
              <div style={{
                position: 'absolute', inset: -24, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(244,197,90,0.22) 0%, transparent 70%)',
                animation: 'kh-pulse 3s ease-in-out infinite',
              }} />
            )}
            <img
              src={`/${lanternLevel}-light.png`}
              alt=""
              draggable={false}
              style={{ width: 180, height: 180, objectFit: 'contain', transition: 'opacity 0.6s ease', position: 'relative', zIndex: 1 }}
            />
          </div>

          <div style={{ textAlign: 'center' }}>
            {state === 'bright' && (p?.sirajStreak ?? 0) > 1 ? (
              <p className="font-black text-lg" style={{ color: 'var(--nuri-gold)' }}>
                {isRtl ? `نورك مستمر منذ ${p!.sirajStreak} أيام` : `${p!.sirajStreak} days of light`}
              </p>
            ) : state === 'bright' ? (
              <p className="font-bold text-base" style={{ color: 'var(--nuri-gold)' }}>
                {isRtl ? 'أتممت وردك اليوم بحمد الله 🌿' : "Today's wird completed 🌿"}
              </p>
            ) : state === 'dim' ? (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--tr-text-muted)', maxWidth: 240 }}>
                {isRtl ? 'خَفَت السراج بالأمس… أعد إليه النور اليوم' : 'The light dimmed yesterday — rekindle it today'}
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'أضئ سراجك — ابدأ رحلتك' : 'Light your siraj — begin your journey'}
              </p>
            )}
          </div>
        </div>

        {/* ── Progress card ── */}
        {p && (
          <div className="rounded-3xl p-5 mb-4" style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? `صفحة ${page} من ${TOTAL_QURAN_PAGES}` : `Page ${page} of ${TOTAL_QURAN_PAGES}`}
              </span>
              {p.totalPagesRead > 0 && (
                <span className="text-[11px]" style={{ color: 'var(--tr-text-muted)', opacity: 0.6 }}>
                  {isRtl ? `${p.totalPagesRead} صفحة مقروءة` : `${p.totalPagesRead} pages read`}
                </span>
              )}
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
          </div>
        )}

        {/* ── CTA ── */}
        {user ? (
          <Link
            href={`/tareeq/khatmati/read?page=${page}&surah=${p?.currentSurah ?? 1}&ayah=${p?.currentAyah ?? 1}`}
            className="flex items-center justify-center gap-2 w-full font-black py-4 rounded-2xl transition active:scale-[0.98] text-[15px]"
            style={{ background: 'var(--nuri-gold)', color: '#0a0c14', letterSpacing: '0.02em' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M19 12H5M12 19l-7-7 7-7' : 'M5 12h14M12 5l7 7-7 7'} />
            </svg>
            {p
              ? (isRtl ? `أكمل ختمتك — صفحة ${page}` : `Continue — Page ${page}`)
              : (isRtl ? 'ابدأ رحلتك الآن' : 'Start Your Journey')}
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
        <p className="text-center text-xs mt-4" style={{ color: 'var(--tr-text-muted)', opacity: 0.45 }}>
          {isRtl ? 'استماع · مصحف · استماع + مصحف' : 'Listen · Read · Listen + Read'}
        </p>
      </div>
    </>
  );
}
