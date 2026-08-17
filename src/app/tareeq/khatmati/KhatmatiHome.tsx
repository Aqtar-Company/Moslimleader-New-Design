'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { SURAH_NAMES_AR, SURAH_NAMES_EN, TOTAL_QURAN_PAGES } from '@/lib/quran-data';

// Y100+M20 CMYK yellow — used directly since this page has a forced dark bg
const NURI_YELLOW = '#FFCC00';
const NURI_YELLOW_DIM = 'rgba(255,204,0,0.18)';
const NURI_YELLOW_GLOW = 'rgba(255,204,0,0.30)';

// Dark navy palette — forced regardless of system theme
const BG_DEEP    = '#080E1C';
const BG_CARD    = 'rgba(255,255,255,0.05)';
const BG_CARD_BD = 'rgba(255,255,255,0.09)';
const TEXT_PRI   = '#F0EDE4';   // warm ivory
const TEXT_MUT   = 'rgba(240,237,228,0.45)';

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
  if (lastReadDate === d.toLocaleDateString('en-CA')) return 'dim';
  return 'dark';
}

export default function KhatmatiHome({ initialProgress }: { initialProgress: Progress | null }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const p = initialProgress;

  // Seed localStorage so bottom nav can quick-resume
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
  const streak = p?.sirajStreak ?? 0;

  const lanternLevel = state === 'dark' ? 0
    : state === 'dim' ? Math.max(0, Math.min(streak - 1, 4))
    : Math.min(streak, 4);

  // Ward status
  const wardDone    = state === 'bright';
  const wardPending = state === 'dim';
  const wardMissed  = state === 'dark' && p !== null;
  const wardNew     = state === 'dark' && p === null;

  return (
    <>
      <style>{`
        @keyframes nuri-glow {
          0%,100% { opacity:.7; transform: scale(1); }
          50%      { opacity:1; transform: scale(1.08); }
        }
        @keyframes nuri-float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes nuri-pulse-ring {
          0%   { transform: scale(0.85); opacity: 0.6; }
          100% { transform: scale(1.4);  opacity: 0; }
        }
      `}</style>

      {/* Forced dark background — covers the entire viewport */}
      <div
        style={{
          minHeight: '100vh',
          background: `radial-gradient(ellipse at 50% 0%, rgba(255,204,0,0.07) 0%, ${BG_DEEP} 55%)`,
          backgroundColor: BG_DEEP,
          paddingBottom: 120,
        }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 20px 0' }}>
          <div>
            <h1 style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 900, fontSize: 28, color: NURI_YELLOW, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              نُوري
            </h1>
            <p style={{ fontSize: 11, marginTop: 2, color: TEXT_MUT }}>
              {isRtl ? 'رحلتك مع القرآن الكريم' : 'Your Quran journey'}
            </p>
          </div>
          {p && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: NURI_YELLOW_DIM, border: `1px solid rgba(255,204,0,0.25)`,
              borderRadius: 12, padding: '6px 14px',
            }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: NURI_YELLOW, lineHeight: 1 }}>{pct}%</span>
              <span style={{ fontSize: 10, color: TEXT_MUT, marginTop: 1 }}>{isRtl ? 'مكتمل' : 'done'}</span>
            </div>
          )}
        </div>

        {/* ── Lantern + glow ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32, marginBottom: 8 }}>
          <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Pulse rings — only when bright */}
            {wardDone && (
              <>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `2px solid ${NURI_YELLOW_GLOW}`,
                  animation: 'nuri-pulse-ring 2.4s ease-out infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `2px solid ${NURI_YELLOW_GLOW}`,
                  animation: 'nuri-pulse-ring 2.4s ease-out 1.2s infinite',
                }} />
              </>
            )}
            {/* Ambient glow behind lantern */}
            {wardDone && (
              <div style={{
                position: 'absolute', inset: -32, borderRadius: '50%',
                background: `radial-gradient(circle, ${NURI_YELLOW_GLOW} 0%, transparent 70%)`,
                animation: 'nuri-glow 3s ease-in-out infinite',
              }} />
            )}
            <img
              src={`/${lanternLevel}-light.png`}
              alt=""
              draggable={false}
              style={{
                width: 180, height: 180, objectFit: 'contain',
                position: 'relative', zIndex: 1,
                animation: wardDone ? 'nuri-float 4s ease-in-out infinite' : 'none',
                transition: 'opacity 0.6s ease',
                filter: wardDone ? 'drop-shadow(0 0 24px rgba(255,204,0,0.55))' : 'none',
              }}
            />
          </div>

          {/* ── Tagline ── */}
          <div style={{ textAlign: 'center', marginTop: 16, paddingInline: 24 }}>
            {wardDone ? (
              <>
                <p style={{ fontWeight: 900, fontSize: 20, color: NURI_YELLOW, marginBottom: 4 }}>
                  {isRtl ? 'أتمم نورك' : 'Keep your light bright'}
                </p>
                {streak > 1 && (
                  <p style={{ fontSize: 13, color: TEXT_MUT }}>
                    {isRtl ? `${streak} أيام متواصلة من النور` : `${streak} days of continuous light`}
                  </p>
                )}
              </>
            ) : wardPending ? (
              <>
                <p style={{ fontWeight: 900, fontSize: 20, color: NURI_YELLOW, marginBottom: 4 }}>
                  {isRtl ? 'أتمم نورك' : 'Rekindle your light'}
                </p>
                <p style={{ fontSize: 13, color: TEXT_MUT }}>
                  {isRtl ? 'خَفَتَ السراج بالأمس — أعِد إليه النور اليوم' : 'The lantern dimmed yesterday — light it again'}
                </p>
              </>
            ) : wardMissed ? (
              <>
                <p style={{ fontWeight: 900, fontSize: 20, color: 'rgba(255,204,0,0.55)', marginBottom: 4 }}>
                  {isRtl ? 'أتمم نورك' : 'Relight your lantern'}
                </p>
                <p style={{ fontSize: 13, color: TEXT_MUT }}>
                  {isRtl ? 'السراج انطفأ — ابدأ من جديد اليوم' : 'The lantern went out — begin again today'}
                </p>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 900, fontSize: 20, color: NURI_YELLOW, marginBottom: 4 }}>
                  {isRtl ? 'أضئ سراجك' : 'Light your lantern'}
                </p>
                <p style={{ fontSize: 13, color: TEXT_MUT }}>
                  {isRtl ? 'ابدأ رحلتك مع القرآن الكريم' : 'Begin your journey with the Quran'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Ward status badge ── */}
        {p && (
          <div style={{ paddingInline: 20, marginBottom: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: wardDone
                ? 'rgba(34,197,94,0.10)'
                : wardPending
                ? 'rgba(255,204,0,0.08)'
                : 'rgba(244,63,94,0.08)',
              border: wardDone
                ? '1px solid rgba(34,197,94,0.22)'
                : wardPending
                ? `1px solid rgba(255,204,0,0.18)`
                : '1px solid rgba(244,63,94,0.18)',
              borderRadius: 14, padding: '10px 14px',
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>
                {wardDone ? '✅' : wardPending ? '⚡' : '🔴'}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: 13, fontWeight: 700,
                  color: wardDone ? '#22c55e' : wardPending ? NURI_YELLOW : '#f43f5e',
                  marginBottom: 1,
                }}>
                  {isRtl
                    ? (wardDone ? 'الورد مكتمل اليوم' : wardPending ? 'الورد معلّق — اقرأ الآن' : 'الورد منقطع')
                    : (wardDone ? 'Daily wird completed' : wardPending ? 'Wird pending — read now' : 'Wird interrupted')}
                </p>
                <p style={{ fontSize: 11, color: TEXT_MUT }}>
                  {isRtl
                    ? (wardDone
                        ? `سلسلة ${streak} ${streak === 1 ? 'يوم' : 'أيام'}`
                        : wardPending
                        ? 'قرأت أمس — واصل اليوم للحفاظ على سلسلتك'
                        : 'انتهت السلسلة — ابدأ سلسلة جديدة')
                    : (wardDone
                        ? `${streak} day${streak !== 1 ? 's' : ''} streak`
                        : wardPending
                        ? 'You read yesterday — continue today to keep your streak'
                        : 'Streak ended — start a new one')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Progress card ── */}
        {p && (
          <div style={{ paddingInline: 20, marginBottom: 16 }}>
            <div style={{ background: BG_CARD, border: `1px solid ${BG_CARD_BD}`, borderRadius: 18, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUT }}>
                  {isRtl ? `صفحة ${page} من ${TOTAL_QURAN_PAGES}` : `Page ${page} of ${TOTAL_QURAN_PAGES}`}
                </span>
                {p.totalPagesRead > 0 && (
                  <span style={{ fontSize: 11, color: TEXT_MUT }}>
                    {isRtl ? `${p.totalPagesRead} صفحة مقروءة` : `${p.totalPagesRead} pages read`}
                  </span>
                )}
              </div>
              {/* Progress bar */}
              <div dir="ltr" style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${NURI_YELLOW} 0%, #FFD740 100%)`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <p style={{ fontSize: 12, textAlign: 'center', color: TEXT_MUT }}>
                {isRtl
                  ? `${surahNameAr} — الآية ${p.currentAyah}`
                  : `${surahNameEn} — Ayah ${p.currentAyah}`}
              </p>
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div style={{ paddingInline: 20 }}>
          {user ? (
            <Link
              href={`/tareeq/khatmati/read?page=${page}&surah=${p?.currentSurah ?? 1}&ayah=${p?.currentAyah ?? 1}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', fontWeight: 900, padding: '16px 0',
                borderRadius: 18, fontSize: 15, letterSpacing: '0.02em',
                background: NURI_YELLOW, color: '#080E1C',
                textDecoration: 'none',
                boxShadow: `0 4px 32px rgba(255,204,0,0.35)`,
              }}
            >
              <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M19 12H5M12 19l-7-7 7-7' : 'M5 12h14M12 5l7 7-7 7'} />
              </svg>
              {p
                ? (isRtl ? `أكمل ختمتك — صفحة ${page}` : `Continue — Page ${page}`)
                : (isRtl ? 'ابدأ رحلتك الآن' : 'Start Your Journey')}
            </Link>
          ) : (
            <Link
              href="/login?next=/tareeq/khatmati"
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                fontWeight: 700, padding: '16px 0', borderRadius: 18, fontSize: 15,
                background: BG_CARD, color: TEXT_PRI,
                border: `1px solid ${BG_CARD_BD}`,
                textDecoration: 'none',
              }}
            >
              {isRtl ? 'سجّل دخولك للبدء' : 'Login to Begin'}
            </Link>
          )}
        </div>

        {/* ── Mode hint ── */}
        <p style={{ textAlign: 'center', fontSize: 11, marginTop: 14, color: TEXT_MUT }}>
          {isRtl ? 'استماع · مصحف · استماع + مصحف' : 'Listen · Read · Listen + Read'}
        </p>
      </div>
    </>
  );
}
