'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  SURAH_NAMES_AR, SURAH_NAMES_EN,
  SURAH_FIRST_PAGES, TOTAL_QURAN_PAGES,
} from '@/lib/quran-data';

const NURI_YELLOW     = '#FFCC00';
const NURI_YELLOW_DIM = 'rgba(255,204,0,0.14)';
const BG_DEEP         = '#080E1C';
const BG_CARD         = 'rgba(255,255,255,0.05)';
const BG_CARD_BD      = 'rgba(255,255,255,0.09)';
const TEXT_PRI        = '#F0EDE4';
const TEXT_MUT        = 'rgba(240,237,228,0.45)';

const DRAFT_PAGES_KEY = 'nuri-daily-pages';

interface Progress {
  currentPage: number; currentSurah: number; currentAyah: number;
  lastReadDate: string | null; sirajStreak: number; totalPagesRead: number;
}

function sirajState(lastReadDate: string | null): 'bright' | 'dim' | 'dark' {
  if (!lastReadDate) return 'dark';
  const today = new Date().toLocaleDateString('en-CA');
  if (lastReadDate === today) return 'bright';
  const d = new Date(); d.setDate(d.getDate() - 1);
  if (lastReadDate === d.toLocaleDateString('en-CA')) return 'dim';
  return 'dark';
}

export default function KhatmatiHome({ initialProgress }: { initialProgress: Progress | null }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const p = initialProgress;

  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const [showSettings, setShowSettings]       = useState(false);
  const [dailyPages, setDailyPages]           = useState(1);
  const [surahSearch, setSurahSearch]         = useState('');

  // Load settings from localStorage + pin dark background to body
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_PAGES_KEY);
      if (stored) setDailyPages(parseInt(stored, 10) || 1);
    } catch { /* ignore */ }
    if (p) {
      localStorage.setItem('nuri-progress', JSON.stringify({
        page: p.currentPage, surah: p.currentSurah, ayah: p.currentAyah,
      }));
    }
    // Force dark bg on body so scrolling past content edge stays dark
    const prev = document.body.style.background;
    document.body.style.background = BG_DEEP;
    return () => { document.body.style.background = prev; };
  }, [p]);

  function saveDailyPages(n: number) {
    setDailyPages(n);
    try { localStorage.setItem(DRAFT_PAGES_KEY, String(n)); } catch { /* ignore */ }
  }

  function goToSurah(surahIdx: number) {
    const page = SURAH_FIRST_PAGES[surahIdx] ?? 1;
    setShowSurahPicker(false);
    setSurahSearch('');
    router.push(`/tareeq/khatmati/read?page=${page}&surah=${surahIdx + 1}&ayah=1`);
  }

  const state      = sirajState(p?.lastReadDate ?? null);
  const page       = p?.currentPage ?? 1;
  const pct        = Math.round((page / TOTAL_QURAN_PAGES) * 100);
  const surahNameAr = SURAH_NAMES_AR[(p?.currentSurah ?? 1) - 1];
  const surahNameEn = SURAH_NAMES_EN[(p?.currentSurah ?? 1) - 1];
  const streak     = p?.sirajStreak ?? 0;

  const lanternLevel = state === 'dark' ? 0
    : state === 'dim' ? Math.max(0, Math.min(streak - 1, 4))
    : Math.min(streak, 4);

  const wardDone    = state === 'bright';
  const wardPending = state === 'dim';
  const wardMissed  = state === 'dark' && p !== null;

  // Filtered surah list
  const filteredSurahs = SURAH_NAMES_AR.map((ar, i) => ({ ar, en: SURAH_NAMES_EN[i], i }))
    .filter(s => surahSearch === '' || s.ar.includes(surahSearch) || s.en.toLowerCase().includes(surahSearch.toLowerCase()) || String(s.i + 1).includes(surahSearch));

  return (
    <>
      <style>{`
        @keyframes nuri-glow  { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes nuri-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes nuri-ring  { 0%{transform:scale(.85);opacity:.55} 100%{transform:scale(1.45);opacity:0} }
        @keyframes nuri-sheet { from{transform:translateY(100%)} to{transform:translateY(0)} }
      `}</style>

      {/* ── Main page ── */}
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100dvh',
          display: 'flex', flexDirection: 'column',
          background: `radial-gradient(ellipse at 50% -10%, rgba(255,204,0,0.09) 0%, ${BG_DEEP} 55%)`,
          backgroundColor: BG_DEEP,
          paddingBottom: 100,
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 20px 0', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontFamily: "'Cairo',sans-serif", fontWeight: 900, fontSize: 28, color: NURI_YELLOW, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              نُوري
            </h1>
            <p style={{ fontSize: 11, marginTop: 2, color: TEXT_MUT }}>
              {isRtl ? 'رحلتك مع القرآن الكريم' : 'Your Quran journey'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Settings gear */}
            <button
              onClick={() => setShowSettings(true)}
              style={{ width: 34, height: 34, borderRadius: '50%', background: BG_CARD, border: `1px solid ${BG_CARD_BD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={1.8}>
                <circle cx="12" cy="12" r="3"/>
                <path strokeLinecap="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </button>
            {/* Percentage pill */}
            {p && (
              <div style={{ background: NURI_YELLOW_DIM, border: '1px solid rgba(255,204,0,0.22)', borderRadius: 12, padding: '5px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: NURI_YELLOW, lineHeight: 1 }}>{pct}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Lantern — grows to fill available space ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBlock: 12 }}>
          <div style={{ position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {wardDone && (
              <>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,204,0,0.28)', animation: 'nuri-ring 2.4s ease-out infinite' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,204,0,0.28)', animation: 'nuri-ring 2.4s ease-out 1.2s infinite' }} />
                <div style={{ position: 'absolute', inset: -32, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,204,0,0.22) 0%, transparent 70%)', animation: 'nuri-glow 3s ease-in-out infinite' }} />
              </>
            )}
            <img
              src={`/${lanternLevel}-light.png`}
              alt=""
              draggable={false}
              style={{
                width: 160, height: 160, objectFit: 'contain', position: 'relative', zIndex: 1,
                animation: wardDone ? 'nuri-float 4s ease-in-out infinite' : 'none',
                filter: wardDone ? 'drop-shadow(0 0 20px rgba(255,204,0,0.5))' : 'none',
              }}
            />
          </div>

          {/* Tagline */}
          <div style={{ textAlign: 'center', marginTop: 16, paddingInline: 28 }}>
            <p style={{ fontWeight: 900, fontSize: 22, color: wardMissed ? 'rgba(255,204,0,0.5)' : NURI_YELLOW, marginBottom: 4 }}>
              {isRtl ? 'أتمم نورك' : wardDone ? 'Keep your light' : 'Light your lantern'}
            </p>
            <p style={{ fontSize: 13, color: TEXT_MUT, lineHeight: 1.5 }}>
              {wardDone
                ? (isRtl ? (streak > 1 ? `${streak} أيام متواصلة من النور` : 'أتممت وردك اليوم بحمد الله') : `${streak} day${streak !== 1 ? 's' : ''} streak`)
                : wardPending
                ? (isRtl ? 'خَفَتَ السراج بالأمس — أعِد إليه النور اليوم' : 'Lantern dimmed — rekindle it today')
                : wardMissed
                ? (isRtl ? 'انطفأ السراج — ابدأ من جديد اليوم' : 'Lantern out — begin again today')
                : (isRtl ? 'ابدأ رحلتك مع القرآن الكريم' : 'Begin your Quran journey')}
            </p>
          </div>
        </div>

        {/* ── Ward status badge ── */}
        {p && (
          <div style={{ paddingInline: 20, marginBottom: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: wardDone ? 'rgba(34,197,94,0.08)' : wardPending ? 'rgba(255,204,0,0.07)' : 'rgba(244,63,94,0.07)',
              border: wardDone ? '1px solid rgba(34,197,94,0.20)' : wardPending ? '1px solid rgba(255,204,0,0.16)' : '1px solid rgba(244,63,94,0.16)',
              borderRadius: 14, padding: '12px 14px',
            }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{wardDone ? '✅' : wardPending ? '⚡' : '🔴'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: wardDone ? '#4ade80' : wardPending ? NURI_YELLOW : '#f87171', marginBottom: 2 }}>
                  {isRtl
                    ? (wardDone ? 'الورد مكتمل اليوم' : wardPending ? 'الورد معلّق — اقرأ الآن' : 'الورد منقطع')
                    : (wardDone ? 'Daily wird complete' : wardPending ? 'Wird pending — read now' : 'Wird interrupted')}
                </p>
                <p style={{ fontSize: 11, color: TEXT_MUT }}>
                  {wardDone
                    ? (isRtl ? `سلسلة ${streak} ${streak === 1 ? 'يوم' : 'أيام'}` : `${streak}-day streak`)
                    : wardPending
                    ? (isRtl ? 'قرأت أمس — واصل اليوم للحفاظ على سلسلتك' : 'Read yesterday — continue today')
                    : (isRtl ? 'انتهت السلسلة — ابدأ سلسلة جديدة' : 'Streak ended — start fresh')}
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
                    {isRtl ? `${p.totalPagesRead} صفحة مقروءة` : `${p.totalPagesRead} read`}
                  </span>
                )}
              </div>
              <div dir="ltr" style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: `linear-gradient(90deg, ${NURI_YELLOW} 0%, #FFD740 100%)`, transition: 'width 0.6s ease' }} />
              </div>
              {/* Clickable surah name → surah picker */}
              <button
                onClick={() => setShowSurahPicker(true)}
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}>
                <span style={{ fontSize: 12, color: NURI_YELLOW, fontWeight: 600 }}>
                  {isRtl ? `${surahNameAr} — الآية ${p.currentAyah}` : `${surahNameEn} — Ayah ${p.currentAyah}`}
                </span>
                <span style={{ fontSize: 10, color: TEXT_MUT, marginInlineStart: 6 }}>▾</span>
              </button>
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
                boxShadow: '0 4px 28px rgba(255,204,0,0.32)',
              }}
            >
              {p
                ? (isRtl ? `أكمل ختمتك — صفحة ${page}` : `Continue — Page ${page}`)
                : (isRtl ? 'ابدأ رحلتك الآن' : 'Start Your Journey')}
              {/* Arrow points RIGHT always */}
              <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <Link
              href="/login?next=/tareeq/khatmati"
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                fontWeight: 700, padding: '16px 0', borderRadius: 18, fontSize: 15,
                background: BG_CARD, color: TEXT_PRI, border: `1px solid ${BG_CARD_BD}`,
                textDecoration: 'none',
              }}
            >
              {isRtl ? 'سجّل دخولك للبدء' : 'Login to Begin'}
            </Link>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, marginTop: 12, color: TEXT_MUT }}>
          {isRtl ? 'استماع · مصحف · استماع + مصحف' : 'Listen · Mushaf · Listen + Mushaf'}
        </p>
      </div>

      {/* ── Surah picker bottom sheet ── */}
      {showSurahPicker && (
        <div
          onClick={() => { setShowSurahPicker(false); setSurahSearch(''); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
              width: '100%', maxHeight: '80dvh',
              background: '#111827', borderRadius: '20px 20px 0 0',
              display: 'flex', flexDirection: 'column',
              animation: 'nuri-sheet 0.28s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            {/* Sheet header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 10px' }}>
              <p style={{ fontWeight: 800, fontSize: 16, color: NURI_YELLOW }}>
                {isRtl ? 'اختر سورة' : 'Choose a Surah'}
              </p>
              <button onClick={() => { setShowSurahPicker(false); setSurahSearch(''); }}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: TEXT_MUT, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
            {/* Search */}
            <div style={{ paddingInline: 16, paddingBottom: 8 }}>
              <input
                autoFocus
                value={surahSearch}
                onChange={e => setSurahSearch(e.target.value)}
                placeholder={isRtl ? 'ابحث عن سورة...' : 'Search surah...'}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: TEXT_PRI, fontSize: 14, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredSurahs.map(({ ar, en, i }) => (
                <button
                  key={i}
                  onClick={() => goToSurah(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    width: '100%', padding: '12px 20px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'start',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: i + 1 === (p?.currentSurah ?? 0) ? NURI_YELLOW_DIM : 'rgba(255,255,255,0.05)',
                    border: i + 1 === (p?.currentSurah ?? 0) ? '1px solid rgba(255,204,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    color: i + 1 === (p?.currentSurah ?? 0) ? NURI_YELLOW : TEXT_MUT,
                  }}>
                    {i + 1}
                  </span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRI, marginBottom: 1 }}>{ar}</p>
                    <p style={{ fontSize: 11, color: TEXT_MUT }}>{en} · ص{SURAH_FIRST_PAGES[i]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Settings bottom sheet ── */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
              width: '100%', background: '#111827',
              borderRadius: '20px 20px 0 0', padding: '20px 20px 40px',
              animation: 'nuri-sheet 0.28s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontWeight: 800, fontSize: 16, color: NURI_YELLOW }}>
                {isRtl ? 'إعدادات ختمتك' : 'Khatmah Settings'}
              </p>
              <button onClick={() => setShowSettings(false)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: TEXT_MUT, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>

            {/* Daily pages target */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRI, marginBottom: 10 }}>
                {isRtl ? 'صفحات الورد اليومي' : 'Daily ward pages'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1, 2, 3, 5, 7, 10, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => saveDailyPages(n)}
                    style={{
                      padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      background: dailyPages === n ? NURI_YELLOW : 'rgba(255,255,255,0.06)',
                      color: dailyPages === n ? '#080E1C' : TEXT_MUT,
                      border: dailyPages === n ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {isRtl ? `${n} ص` : `${n}p`}
                  </button>
                ))}
              </div>
              {/* Estimate */}
              <p style={{ fontSize: 11, color: TEXT_MUT, marginTop: 10 }}>
                {isRtl
                  ? `بهذا الورد ستختم القرآن في ${Math.ceil(TOTAL_QURAN_PAGES / dailyPages)} يوم`
                  : `At this pace, you'll finish in ${Math.ceil(TOTAL_QURAN_PAGES / dailyPages)} days`}
              </p>
            </div>

            {/* Jump to surah */}
            <button
              onClick={() => { setShowSettings(false); setShowSurahPicker(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '13px 16px', borderRadius: 12, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 10,
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={1.8}>
                <path strokeLinecap="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRI }}>
                {isRtl ? 'انتقل إلى سورة' : 'Jump to Surah'}
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
