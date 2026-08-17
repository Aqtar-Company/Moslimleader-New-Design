'use client';
import React, { useState, useEffect, useRef } from 'react';
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
const BG_DEEP         = '#05101f';   // dark navy blue
const BG_CARD         = 'rgba(255,255,255,0.05)';
const BG_CARD_BD      = 'rgba(255,255,255,0.09)';
const TEXT_PRI        = '#F0EDE4';
const TEXT_MUT        = 'rgba(240,237,228,0.45)';

// Circular SVG arc progress component
function LampProgress({ pct, lanternLevel, wardDone, children }: {
  pct: number; lanternLevel: number; wardDone: boolean; children: React.ReactNode;
}) {
  const R = 96;
  const circ = 2 * Math.PI * R;
  const offset = circ * (1 - pct / 100);
  // Stage milestones at 20%, 40%, 60%, 80%, 100% → 5 stages matching lanternLevel (0-4)
  const stageAngles = [72, 144, 216, 288, 360]; // degrees from top
  return (
    <div style={{ position: 'relative', width: 210, height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {/* SVG ring */}
      <svg width={210} height={210} viewBox="0 0 210 210" style={{ position: 'absolute', inset: 0 }} >
        {/* Track */}
        <circle cx={105} cy={105} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
        {/* Progress arc — CCW from top */}
        <circle
          cx={105} cy={105} r={R}
          fill="none"
          stroke={wardDone ? NURI_YELLOW : 'rgba(255,204,0,0.45)'}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 105 105)"
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.6s ease' }}
        />
        {/* Stage milestone dots */}
        {stageAngles.map((deg, i) => {
          const rad = (deg - 90) * (Math.PI / 180);
          const x = 105 + R * Math.cos(rad);
          const y = 105 + R * Math.sin(rad);
          const filled = i <= lanternLevel - 1 || pct >= (i + 1) * 20;
          return (
            <circle key={i}
              cx={x} cy={y} r={4.5}
              fill={filled ? NURI_YELLOW : 'rgba(255,255,255,0.15)'}
              stroke={filled ? 'rgba(255,204,0,0.4)' : 'none'}
              strokeWidth={2}
              style={{ transition: 'fill 0.5s ease' }}
            />
          );
        })}
      </svg>
      {/* Lamp in centre */}
      {children}
    </div>
  );
}

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

interface GroupCard { id: string; name: string; dailyGoal: number; memberCount: number; myStreak: number; myPoints: number; myTotalPages: number; readToday: boolean; }

export default function KhatmatiHome({ initialProgress, initialGroups = [] }: { initialProgress: Progress | null; initialGroups?: GroupCard[] }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const p = initialProgress;

  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const [showSettings, setShowSettings]       = useState(false);
  const [dailyPages, setDailyPages]           = useState(1);
  const [surahSearch, setSurahSearch]         = useState('');
  const [reminderOn, setReminderOn]           = useState(false);
  const [sharing, setSharing]                 = useState(false);
  const [lanternLit, setLanternLit]           = useState(false);

  // Load settings from localStorage + pin dark background to body
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_PAGES_KEY);
      if (stored) setDailyPages(parseInt(stored, 10) || 1);
      const rem = localStorage.getItem('nuri-reminder');
      if (rem === '1') setReminderOn(true);
    } catch { /* ignore */ }
    if (p) {
      localStorage.setItem('nuri-progress', JSON.stringify({
        page: p.currentPage, surah: p.currentSurah, ayah: p.currentAyah,
      }));
      // Store last-read info so the footer icon knows the lantern level
      localStorage.setItem('nuri-last-read', JSON.stringify({
        date: p.lastReadDate, streak: p.sirajStreak,
      }));
    }
    // Force dark blue bg on both <html> and <body> so overscroll stays themed on iOS/Android
    const prevBody = document.body.style.background;
    const prevHtml = document.documentElement.style.background;
    document.body.style.background = BG_DEEP;
    document.documentElement.style.background = BG_DEEP;
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.background = prevBody;
      document.documentElement.style.background = prevHtml;
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
    };
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

  async function toggleReminder() {
    const next = !reminderOn;
    setReminderOn(next);
    try { localStorage.setItem('nuri-reminder', next ? '1' : '0'); } catch { /* ignore */ }
    try {
      await fetch('/api/tareeq/khatmati/remind', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: next }),
      });
    } catch { /* ignore */ }
  }

  async function handleShare() {
    if (!p || sharing) return;
    setSharing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 900; canvas.height = 900;
      const ctx = canvas.getContext('2d')!;
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 900);
      grad.addColorStop(0, '#0a1e3d');
      grad.addColorStop(0.55, '#05101f');
      grad.addColorStop(1, '#071422');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 900, 900);
      // Gold ring
      ctx.beginPath(); ctx.arc(450, 360, 220, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,204,0,0.18)'; ctx.lineWidth = 3; ctx.stroke();
      // Progress arc
      const pctNum = Math.round((p.currentPage / TOTAL_QURAN_PAGES) * 100);
      ctx.beginPath();
      ctx.arc(450, 360, 220, -Math.PI / 2, -Math.PI / 2 + (pctNum / 100) * Math.PI * 2);
      ctx.strokeStyle = '#FFCC00'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
      // Lantern emoji centre
      ctx.font = '110px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🕯️', 450, 345);
      // Percentage
      ctx.font = 'bold 72px sans-serif'; ctx.fillStyle = '#FFCC00';
      ctx.fillText(`${pctNum}%`, 450, 470);
      // Title
      ctx.font = 'bold 40px Cairo,sans-serif'; ctx.fillStyle = '#F0EDE4';
      ctx.fillText('نُوري · ختمتك', 450, 540);
      // Sub stats
      ctx.font = '32px sans-serif'; ctx.fillStyle = 'rgba(240,237,228,0.5)';
      ctx.fillText(`صفحة ${p.currentPage} / ${TOTAL_QURAN_PAGES}   🔥 ${p.sirajStreak} يوم`, 450, 600);
      // Watermark
      ctx.font = '24px sans-serif'; ctx.fillStyle = 'rgba(255,204,0,0.4)';
      ctx.fillText('moslimleader.com', 450, 860);

      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(), 'image/png'));
      const file = new File([blob], 'nuri-progress.png', { type: 'image/png' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ختمتي على نُوري' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'nuri-progress.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch { /* user cancelled or share failed */ }
    setSharing(false);
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
        @keyframes nuri-glow   { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes nuri-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes nuri-ring   { 0%{transform:scale(.85);opacity:.55} 100%{transform:scale(1.45);opacity:0} }
        @keyframes nuri-sheet  { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes nuri-pulse  { 0%,100%{opacity:.5;filter:drop-shadow(0 0 3px #FFCC00)} 50%{opacity:1;filter:drop-shadow(0 0 10px #FFCC00)} }
        html,body { background: #05101f !important; }
      `}</style>

      {/* ── Main page ── */}
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100dvh',
          display: 'flex', flexDirection: 'column',
          background: `linear-gradient(160deg, #0a1e3d 0%, ${BG_DEEP} 50%, #071422 100%)`,
          backgroundColor: BG_DEEP,
          paddingBottom: 100,
          overscrollBehavior: 'none',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 20px 0', flexShrink: 0 }}>
          <h1 style={{ fontFamily: "'Cairo',sans-serif", fontWeight: 900, fontSize: 30, color: NURI_YELLOW, letterSpacing: '-0.01em', lineHeight: 1 }}>
            نُوري
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Groups button */}
            <button
              onClick={() => router.push('/tareeq/khatmati/groups')}
              style={{ width: 34, height: 34, borderRadius: '50%', background: BG_CARD, border: `1px solid ${BG_CARD_BD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title={isRtl ? 'ختمات جماعية' : 'Group Khatmas'}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </button>
            {/* Stats button */}
            <button
              onClick={() => router.push('/tareeq/khatmati/stats')}
              style={{ width: 34, height: 34, borderRadius: '50%', background: BG_CARD, border: `1px solid ${BG_CARD_BD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title={isRtl ? 'إحصائياتي' : 'My Stats'}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={1.8}>
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </button>
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

        {/* ── Lantern + progress ring — fills available space ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBlock: 4, minHeight: 0 }}>

          <LampProgress pct={pct} lanternLevel={lanternLevel} wardDone={wardDone}>
            {/* Glow effects when bright or manually lit */}
            {(wardDone || lanternLit) && (
              <>
                <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', border: '1.5px solid rgba(255,204,0,0.3)', animation: 'nuri-ring 2.4s ease-out infinite' }} />
                <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', border: '1.5px solid rgba(255,204,0,0.3)', animation: 'nuri-ring 2.4s ease-out 1.2s infinite' }} />
                <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,204,0,0.18) 0%, transparent 70%)', animation: 'nuri-glow 3s ease-in-out infinite', pointerEvents: 'none' }} />
              </>
            )}
            <img
              src={`/${lanternLit ? 4 : lanternLevel}-light.png`}
              alt=""
              draggable={false}
              onClick={() => { setLanternLit(true); setTimeout(() => setLanternLit(false), 2000); }}
              style={{
                width: 148, height: 148, objectFit: 'contain', position: 'relative', zIndex: 1,
                animation: (wardDone || lanternLit) ? 'nuri-float 4s ease-in-out infinite' : 'none',
                filter: (wardDone || lanternLit) ? 'drop-shadow(0 0 18px rgba(255,204,0,0.5))' : 'none',
                cursor: 'pointer', transition: 'filter 0.4s',
              }}
            />
          </LampProgress>

          {/* Stage label under ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{
                width: i === lanternLevel ? 22 : 7, height: 7,
                borderRadius: 4,
                background: i < lanternLevel ? NURI_YELLOW : i === lanternLevel ? 'rgba(255,204,0,0.7)' : 'rgba(255,255,255,0.12)',
                transition: 'all 0.5s ease',
              }} />
            ))}
          </div>

          {/* Tagline */}
          <div style={{ textAlign: 'center', paddingInline: 28, marginTop: 2 }}>
            <p style={{ fontWeight: 900, fontSize: 20, color: wardMissed ? 'rgba(255,204,0,0.5)' : NURI_YELLOW, marginBottom: 0, lineHeight: 1.2 }}>
              {isRtl
                ? (wardDone ? 'نورك مكتمل اليوم' : 'استمر في القراءة ليكتمل نورك')
                : (wardDone ? 'Light shining today!' : 'Keep reading to complete your light')}
            </p>
          </div>
        </div>

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
              {/* Arrow first in JSX → appears on RIGHT in RTL flex row */}
              <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
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
                background: BG_CARD, color: TEXT_PRI, border: `1px solid ${BG_CARD_BD}`,
                textDecoration: 'none',
              }}
            >
              {isRtl ? 'سجّل دخولك للبدء' : 'Login to Begin'}
            </Link>
          )}
        </div>

        {/* Share progress — only when progress exists */}
        {p && user && (
          <div style={{ paddingInline: 20, marginTop: 10 }}>
            <button
              onClick={handleShare}
              disabled={sharing}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '11px 0', borderRadius: 14,
                background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.2)',
                color: NURI_YELLOW, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                opacity: sharing ? 0.6 : 1,
              }}
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              {isRtl ? 'مشاركة تقدمي' : 'Share Progress'}
            </button>
          </div>
        )}

        {/* ── Group Khatmas ── */}
        {initialGroups.length > 0 && (
          <div style={{ paddingInline: 20, marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: NURI_YELLOW }}>
                {isRtl ? 'ختماتي الجماعية' : 'My Group Khatmas'}
              </p>
              <button onClick={() => router.push('/tareeq/khatmati/groups')}
                style={{ fontSize: 12, color: TEXT_MUT, background: 'none', border: 'none', cursor: 'pointer' }}>
                {isRtl ? 'عرض الكل' : 'See all'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {initialGroups.map(g => (
                <button key={g.id} onClick={() => router.push(`/tareeq/khatmati/groups/${g.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: BG_CARD, border: `1px solid ${BG_CARD_BD}`,
                    borderRadius: 16, padding: '12px 14px', width: '100%', textAlign: 'start', cursor: 'pointer',
                  }}>
                  {/* Book icon — green glow if read today, yellow pulse if not */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: g.readToday ? 'rgba(74,222,128,0.12)' : 'rgba(255,204,0,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
                      stroke={g.readToday ? '#4ade80' : '#FFCC00'} strokeWidth={1.8}
                      style={{
                        filter: g.readToday ? 'drop-shadow(0 0 6px rgba(74,222,128,0.8))' : undefined,
                        animation: g.readToday ? 'none' : 'nuri-pulse 2s ease-in-out infinite',
                      }}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRI, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</p>
                    <p style={{ fontSize: 11, color: TEXT_MUT }}>
                      {isRtl
                        ? `${g.memberCount} عضو · هدف ${g.dailyGoal} ص/يوم`
                        : `${g.memberCount} members · ${g.dailyGoal}p/day`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 900, color: NURI_YELLOW, lineHeight: 1 }}>{g.myStreak}</p>
                    <p style={{ fontSize: 10, color: TEXT_MUT }}>{isRtl ? 'يوم' : 'days'}</p>
                  </div>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={2} style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M15.75 19.5L8.25 12l7.5-7.5' : 'M8.25 4.5l7.5 7.5-7.5 7.5'} />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
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

            {/* Daily reminder toggle */}
            <button
              onClick={toggleReminder}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '13px 16px', borderRadius: 12, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRI, flex: 1 }}>
                {isRtl ? 'تذكير يومي' : 'Daily Reminder'}
              </span>
              {/* Toggle pill */}
              <div style={{
                width: 44, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0,
                background: reminderOn ? NURI_YELLOW : 'rgba(255,255,255,0.12)',
                transition: 'background 0.25s',
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: reminderOn ? 22 : 2, width: 20, height: 20,
                  borderRadius: '50%', background: reminderOn ? '#080E1C' : 'rgba(255,255,255,0.5)',
                  transition: 'left 0.25s',
                }} />
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
