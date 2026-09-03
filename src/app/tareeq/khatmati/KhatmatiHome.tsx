'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  SURAH_NAMES_AR, SURAH_NAMES_EN,
  SURAH_FIRST_PAGES, TOTAL_QURAN_PAGES,
} from '@/lib/quran-data';

const NURI_YELLOW     = '#FFCC33';
const NURI_YELLOW_DIM = 'rgba(255,204,51,0.14)';
const BG_DEEP         = '#020C1B';
const BG_MID          = '#061428';
const BG_TOP          = '#0D2244';
const BG_CARD         = 'rgba(255,255,255,0.06)';
const BG_CARD_BD      = 'rgba(255,255,255,0.10)';
const TEXT_PRI        = '#F0EDE4';
const TEXT_MUT        = 'rgba(240,237,228,0.45)';
const BG_GRADIENT     = `linear-gradient(170deg, ${BG_TOP} 0%, ${BG_MID} 38%, ${BG_DEEP} 68%, #030E1E 100%)`;

const DRAFT_PAGES_KEY = 'nuri-daily-pages';

// ── Thin circular progress ring — single outer arc ───────────────────────────
function LampRing({ pct, wardDone, lanternLit, children }: {
  pct: number; wardDone: boolean; lanternLit: boolean; children: React.ReactNode;
}) {
  const R = 100; const S = 220; const C = S / 2;
  const circ = 2 * Math.PI * R;
  const offset = circ * (1 - pct / 100);
  const glowing = wardDone || lanternLit;
  return (
    <div style={{ position: 'relative', width: S, height: S, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ position: 'absolute', inset: 0 }}>
        {/* track */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
        {/* Khatma progress arc */}
        <circle
          cx={C} cy={C} r={R} fill="none"
          stroke={glowing ? NURI_YELLOW : 'rgba(255,204,51,0.38)'}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${C} ${C})`}
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.6s ease' }}
        />
      </svg>
      {/* glow pulses */}
      {glowing && (
        <>
          <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: '1px solid rgba(255,204,51,0.25)', animation: 'nuri-ring 2.6s ease-out infinite' }} />
          <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: '1px solid rgba(255,204,51,0.18)', animation: 'nuri-ring 2.6s ease-out 1.3s infinite' }} />
          <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,204,51,0.14) 0%, transparent 70%)', animation: 'nuri-glow 3s ease-in-out infinite', pointerEvents: 'none' }} />
        </>
      )}
      {children}
    </div>
  );
}

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

interface GroupCard { id: string; name: string; dailyGoal: number; memberCount: number; myStreak: number; myPoints: number; myTotalPages: number; readToday: boolean; myCurrentPage: number; myCurrentSurah: number; myCurrentAyah: number; }

export default function KhatmatiHome({ initialProgress, initialGroups = [] }: { initialProgress: Progress | null; initialGroups?: GroupCard[] }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const p = initialProgress;

  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const [showSettings, setShowSettings]       = useState(false);
  const [dailyPages, setDailyPages]           = useState(1);
  const [customPages, setCustomPages]         = useState('');
  const [surahSearch, setSurahSearch]         = useState('');
  const [reminderOn, setReminderOn]           = useState(false);
  const [sharing, setSharing]                 = useState(false);
  const [lanternLit, setLanternLit]           = useState(false);
  const [showBlessing, setShowBlessing]       = useState(false);
  const [dailyProgress, setDailyProgress]     = useState(0); // pages read today
  const [confirmReset, setConfirmReset]       = useState(false);
  const currentSurahRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_PAGES_KEY);
      if (stored) setDailyPages(parseInt(stored, 10) || 1);
      const rem = localStorage.getItem('nuri-reminder');
      if (rem === '1') setReminderOn(true);
      // Load today's ward (wird) progress
      const prog = localStorage.getItem('nuri-daily-progress');
      if (prog) {
        const data = JSON.parse(prog);
        const today = new Date().toLocaleDateString('en-CA');
        if (data?.date === today) setDailyProgress(data.pagesRead || 0);
      }
    } catch { /* ignore */ }
    if (p) {
      localStorage.setItem('nuri-progress', JSON.stringify({
        page: p.currentPage, surah: p.currentSurah, ayah: p.currentAyah,
      }));
      localStorage.setItem('nuri-last-read', JSON.stringify({
        date: p.lastReadDate, streak: p.sirajStreak,
      }));
    }
    const prevBodyBg = document.body.style.background;
    const prevHtmlBg = document.documentElement.style.background;
    document.body.style.background = BG_DEEP;
    document.documentElement.style.background = BG_DEEP;
    document.body.style.backgroundImage = BG_GRADIENT;
    document.documentElement.style.backgroundImage = BG_GRADIENT;
    // Override the Tareeq layout root which has var(--tr-base) — without this
    // its light background shows below the dark content when scrolling on mobile.
    const tareeqRoot = document.querySelector<HTMLElement>('[data-tareeq-root]');
    const prevRootBg = tareeqRoot?.style.background ?? '';
    if (tareeqRoot) tareeqRoot.style.setProperty('background', BG_DEEP, 'important');
    return () => {
      document.body.style.background = prevBodyBg;
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.backgroundImage = '';
      document.documentElement.style.backgroundImage = '';
      if (tareeqRoot) {
        tareeqRoot.style.removeProperty('background');
        if (prevRootBg) tareeqRoot.style.background = prevRootBg;
      }
    };
  }, [p]);

  // Auto-scroll to current surah when picker opens
  useEffect(() => {
    if (showSurahPicker) {
      const t = setTimeout(() => currentSurahRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
      return () => clearTimeout(t);
    }
  }, [showSurahPicker]);

  async function resetKhatma() {
    try {
      localStorage.setItem('nuri-progress', JSON.stringify({ page: 1, surah: 1, ayah: 1 }));
      await fetch('/api/tareeq/khatmati/progress', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 1, surah: 1, ayah: 1, totalPagesRead: 0 }),
      });
      window.location.reload();
    } catch { /* ignore */ }
  }

  function saveDailyPages(n: number) {
    setDailyPages(n);
    setCustomPages('');
    try {
      localStorage.setItem(DRAFT_PAGES_KEY, String(n));
      // Re-read daily progress so lamp updates immediately on goal change
      const prog = localStorage.getItem('nuri-daily-progress');
      if (prog) {
        const data = JSON.parse(prog);
        const today = new Date().toLocaleDateString('en-CA');
        if (data?.date === today) setDailyProgress(data.pagesRead || 0);
      }
    } catch { /* ignore */ }
  }

  function applyCustomPages() {
    const n = parseInt(customPages, 10);
    if (n >= 1 && n <= 604) saveDailyPages(n);
  }

  function goToSurah(surahIdx: number) {
    const page = SURAH_FIRST_PAGES[surahIdx] ?? 1;
    setShowSurahPicker(false); setSurahSearch('');
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
      const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
        const img = new window.Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
      });
      const [lanternImg, logoImg] = await Promise.all([
        loadImg(`/${pctLevel}-light.png`),
        loadImg('/Tareeq-small.png').catch(() => null),
      ]);
      const grad = ctx.createLinearGradient(0, 0, 0, 900);
      grad.addColorStop(0, '#0a1e3d'); grad.addColorStop(0.55, '#05101f'); grad.addColorStop(1, '#071422');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 900, 900);
      ctx.beginPath(); ctx.arc(450, 360, 220, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,204,51,0.18)'; ctx.lineWidth = 3; ctx.stroke();
      const pctNum = Math.round((p.currentPage / TOTAL_QURAN_PAGES) * 100);
      ctx.beginPath();
      ctx.arc(450, 360, 220, -Math.PI / 2, -Math.PI / 2 + (pctNum / 100) * Math.PI * 2);
      ctx.strokeStyle = '#FFCC00'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
      ctx.drawImage(lanternImg, 450 - 95, 360 - 95, 190, 190);
      ctx.font = 'bold 72px sans-serif'; ctx.fillStyle = '#FFCC00';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${pctNum}%`, 450, 470);
      ctx.font = 'bold 40px Cairo,sans-serif'; ctx.fillStyle = '#F0EDE4';
      ctx.fillText('نُوري · ختمتك', 450, 540);
      ctx.font = '32px sans-serif'; ctx.fillStyle = 'rgba(240,237,228,0.5)';
      ctx.fillText(`صفحة ${p.currentPage} / ${TOTAL_QURAN_PAGES}   ·   ${p.sirajStreak} يوم`, 450, 600);
      if (logoImg) {
        const lw = 140; const lh = Math.round(lw * logoImg.height / Math.max(logoImg.width, 1));
        ctx.drawImage(logoImg, 450 - lw / 2, 830 - lh / 2, lw, lh);
      } else {
        ctx.font = '24px sans-serif'; ctx.fillStyle = 'rgba(255,204,51,0.4)';
        ctx.fillText('moslimleader.com', 450, 860);
      }
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(), 'image/png'));
      const file = new File([blob], 'nuri-progress.png', { type: 'image/png' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ختمتي على نُوري' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'nuri-progress.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch { /* user cancelled */ }
    setSharing(false);
  }

  const state       = sirajState(p?.lastReadDate ?? null);
  const page        = p?.currentPage ?? 1;
  const pct         = Math.round((page / TOTAL_QURAN_PAGES) * 100);
  const surahNameAr = SURAH_NAMES_AR[(p?.currentSurah ?? 1) - 1];
  const surahNameEn = SURAH_NAMES_EN[(p?.currentSurah ?? 1) - 1];
  const streak      = p?.sirajStreak ?? 0;

  const lanternLevel = state === 'dark' ? 0
    : state === 'dim' ? Math.max(0, Math.min(streak - 1, 4))
    : Math.min(streak, 4);

  // pct-based illumination: image and overlay
  const pctLevel = pct === 0 ? 0 : Math.min(4, Math.ceil(pct * 4 / 100));
  const overlayOpacity = Math.max(0, 0.5 * (1 - pct / 100));

  // Daily wird progress (0.0 → 1.0): pages read today / daily goal
  const wardProgress = dailyPages > 0 ? Math.min(dailyProgress / dailyPages, 1.0) : 0;
  // Ward is done when daily goal reached OR server confirms they read today (for goal=1 compat)
  const wardDone   = wardProgress >= 1.0 || state === 'bright';
  const wardMissed = state === 'dark' && p !== null && wardProgress === 0;

  const filteredSurahs = SURAH_NAMES_AR.map((ar, i) => ({ ar, en: SURAH_NAMES_EN[i], i }))
    .filter(s => surahSearch === '' || s.ar.includes(surahSearch) || s.en.toLowerCase().includes(surahSearch.toLowerCase()) || String(s.i + 1).includes(surahSearch));

  const PRESET_PAGES = [1, 2, 3, 5, 7, 10, 20];
  const isCustom = !PRESET_PAGES.includes(dailyPages);

  return (
    <>
      <style>{`
        @keyframes nuri-glow  { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes nuri-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes nuri-ring  { 0%{transform:scale(.85);opacity:.5} 100%{transform:scale(1.5);opacity:0} }
        @keyframes nuri-sheet { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes nuri-pulse { 0%,100%{opacity:.5;filter:drop-shadow(0 0 3px #FFCC33)} 50%{opacity:1;filter:drop-shadow(0 0 10px #FFCC33)} }
        @keyframes nuri-complete { 0%{transform:scale(0.88);opacity:0.5} 100%{transform:scale(1);opacity:1} }
        @keyframes nuri-blessing { 0%{opacity:0;transform:translateX(-50%) translateY(4px)} 20%{opacity:1;transform:translateX(-50%) translateY(0)} 80%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(-6px)} }
        html, body, [data-tareeq-root] { background: #020C1B !important; background-image: linear-gradient(170deg, #0D2244 0%, #061428 38%, #020C1B 68%, #030E1E 100%) !important; background-attachment: fixed !important; }
        .nuri-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          display: 'flex', flexDirection: 'column',
          background: BG_GRADIENT,
          backgroundColor: BG_DEEP,
          paddingBottom: 80,
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', flexShrink: 0 }}>
          <h1 style={{ fontFamily: "'Cairo',sans-serif", fontWeight: 900, fontSize: 30, color: NURI_YELLOW, letterSpacing: '-0.01em', lineHeight: 1 }}>
            نُوري
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Settings gear */}
            <button
              onClick={() => setShowSettings(true)}
              style={{ width: 40, height: 40, borderRadius: '50%', background: BG_CARD, border: `1px solid ${BG_CARD_BD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={1.8}>
                <circle cx="12" cy="12" r="3"/>
                <path strokeLinecap="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </button>
            {/* Groups shortcut */}
            <button
              onClick={() => router.push('/tareeq/khatmati/groups')}
              style={{ width: 40, height: 40, borderRadius: '50%', background: BG_CARD, border: `1px solid ${BG_CARD_BD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </button>
            {/* Percentage pill */}
            {p && (
              <div style={{ background: NURI_YELLOW_DIM, border: '1px solid rgba(255,204,51,0.22)', borderRadius: 12, padding: '5px 12px' }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: NURI_YELLOW, lineHeight: 1 }}>{pct}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Lantern + ring ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBlock: 18, flexShrink: 0, position: 'relative' }}>
          {/* Radial luxury glow behind the ring */}
          <div style={{ position: 'absolute', width: 340, height: 200, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(15,50,120,0.55) 0%, rgba(5,20,60,0.25) 55%, transparent 75%)', top: '50%', left: '50%', transform: 'translate(-50%,-52%)', pointerEvents: 'none' }} />
          <LampRing pct={pct} wardDone={wardDone} lanternLit={lanternLit}>
            <img
              src={`/${lanternLit ? 4 : pctLevel}-light.png`}
              alt=""
              draggable={false}
              onClick={() => { setLanternLit(true); setShowBlessing(true); setTimeout(() => { setLanternLit(false); setShowBlessing(false); }, 2000); }}
              style={{
                width: 150, height: 150, objectFit: 'contain', position: 'relative', zIndex: 1,
                animation: (wardDone || lanternLit) ? 'nuri-float 4s ease-in-out infinite' : (wardProgress > 0 ? 'nuri-float 6s ease-in-out infinite' : 'none'),
                filter: `brightness(${(lanternLit ? 1 : Math.min(1, 0.30 + pctLevel * 0.14 + wardProgress * 0.45)).toFixed(2)})${(wardDone || lanternLit) ? ' drop-shadow(0 0 28px rgba(255,204,51,0.65))' : wardProgress > 0.3 ? ` drop-shadow(0 0 ${Math.round(wardProgress * 16)}px rgba(255,204,51,${(wardProgress * 0.5).toFixed(2)}))` : ''}`,
                cursor: 'pointer', transition: 'filter 0.8s ease',
              }}
            />
            {showBlessing && (
              <div style={{ position: 'absolute', bottom: -32, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700, color: NURI_YELLOW, animation: 'nuri-blessing 2s ease-in-out forwards', pointerEvents: 'none' }}>
                نوّر الله قلبك ✨
              </div>
            )}
          </LampRing>

          {/* Tagline */}
          <p style={{ fontWeight: wardDone ? 900 : 800, fontSize: wardDone ? 17 : 15, color: wardMissed ? 'rgba(255,204,51,0.45)' : NURI_YELLOW, textAlign: 'center', margin: 0, lineHeight: 1.2, animation: wardDone ? 'nuri-complete 0.5s cubic-bezier(0.34,1.56,0.64,1)' : 'none' }}>
            {wardDone
              ? (isRtl ? 'بارك الله في تلاوتك اليوم ✓' : 'May Allah bless your recitation ✓')
              : (isRtl ? 'استمر في التلاوة ليكتمل نورك' : 'Continue your recitation')}
          </p>

          {/* Daily wird counter */}
          {p && dailyPages > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: wardDone ? '#4ade80' : TEXT_MUT }}>
                {isRtl
                  ? `${dailyProgress} / ${dailyPages} صفحة اليوم`
                  : `${dailyProgress} / ${dailyPages} pages today`}
              </span>
              {wardDone && <span style={{ fontSize: 13 }}>✓</span>}
              {!wardDone && dailyProgress > 0 && (
                <span style={{ fontSize: 13, color: 'rgba(240,237,228,0.7)' }}>
                  {isRtl ? `· ${dailyPages - dailyProgress} متبقية` : `· ${dailyPages - dailyProgress} left`}
                </span>
              )}
            </div>
          )}

        </div>

        {/* ── Streak danger banner ── */}
        {state === 'dim' && p && streak > 0 && (
          <div style={{ marginInline: 20, marginBottom: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#fb923c', margin: '0 0 2px' }}>
                {isRtl ? `سلسلتك ${streak} يوماً في خطر!` : `Your ${streak}-day streak is at risk!`}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(251,146,60,0.7)', margin: 0 }}>
                {isRtl ? 'اقرأ اليوم قبل منتصف الليل للحفاظ عليها' : 'Read before midnight to keep it'}
              </p>
            </div>
            <button
              onClick={() => router.push(`/tareeq/khatmati/read?page=${page}&surah=${p?.currentSurah ?? 1}&ayah=${p?.currentAyah ?? 1}`)}
              style={{ padding: '6px 12px', borderRadius: 8, background: '#fb923c', color: '#fff', fontWeight: 800, fontSize: 12, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              {isRtl ? 'اقرأ الآن' : 'Read now'}
            </button>
          </div>
        )}

        {/* ── Solo khatma unified card ── */}
        <div style={{ paddingInline: 20, flexShrink: 0 }}>
          {user ? (
            <div style={{
              background: wardDone
                ? 'linear-gradient(135deg, rgba(255,204,51,0.18) 0%, rgba(255,215,0,0.09) 100%)'
                : 'linear-gradient(135deg, rgba(255,204,51,0.12) 0%, rgba(255,215,0,0.06) 100%)',
              border: `1px solid ${wardDone ? 'rgba(255,204,51,0.35)' : 'rgba(255,204,51,0.18)'}`,
              borderRadius: 18,
              overflow: 'hidden',
            }}>
              {/* Surah + page row (tappable → surah picker) */}
              <button
                onClick={() => setShowSurahPicker(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '11px 16px 8px', background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: NURI_YELLOW }}>
                  {p ? (isRtl ? `${surahNameAr} — الآية ${p.currentAyah}` : `${surahNameEn} — Ayah ${p.currentAyah}`) : (isRtl ? 'ابدأ رحلتك' : 'Start your journey')}
                  {p && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={2.5} style={{ marginInlineStart: 4, flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>}
                </span>
                {p && (
                  <span style={{ fontSize: 11, color: TEXT_MUT }}>
                    {isRtl ? `صفحة ${page} / ${TOTAL_QURAN_PAGES}` : `Page ${page} / ${TOTAL_QURAN_PAGES}`}
                  </span>
                )}
              </button>

              {/* Progress bar */}
              {p && (
                <div style={{ paddingInline: 16, paddingBottom: 8 }}>
                  <div dir="ltr" style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: `linear-gradient(90deg, ${NURI_YELLOW}, #FFD740)`, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )}

              {/* Action row: CTA + share */}
              <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(255,204,51,0.12)' }}>
                {/* Main CTA */}
                <button
                  onClick={() => router.push(`/tareeq/khatmati/read?page=${page}&surah=${p?.currentSurah ?? 1}&ayah=${p?.currentAyah ?? 1}`)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px 0', background: NURI_YELLOW, color: '#080E1C',
                    fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer',
                    letterSpacing: '0.01em',
                  }}
                >
                  <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  {p
                    ? (isRtl ? `ختمة فردية — صفحة ${page}` : `Solo — Page ${page}`)
                    : (isRtl ? 'ابدأ رحلتك الآن' : 'Start Your Journey')}
                </button>

                {/* Share divider + button */}
                {p && (
                  <button
                    onClick={handleShare}
                    disabled={sharing}
                    style={{
                      width: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,204,51,0.5)', color: '#080E1C',
                      borderInlineStart: '1px solid rgba(0,0,0,0.12)',
                      border: 'none', cursor: 'pointer', opacity: sharing ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                  >
                    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => router.push('/login?next=/tareeq/khatmati')}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                fontWeight: 700, padding: '16px 0', borderRadius: 18, fontSize: 15,
                background: BG_CARD, color: TEXT_PRI, border: `1px solid ${BG_CARD_BD}`, cursor: 'pointer',
              }}
            >
              {isRtl ? 'سجّل دخولك للبدء' : 'Login to Begin'}
            </button>
          )}
        </div>

        {/* ── Empty-groups CTA ── */}
        {user && initialGroups.length === 0 && (
          <div style={{ paddingInline: 20, marginTop: 16, flexShrink: 0 }}>
            <button
              onClick={() => router.push('/tareeq/khatmati/groups')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                width: '100%', padding: '16px 20px', borderRadius: 18, cursor: 'pointer',
                background: 'rgba(255,204,51,0.08)', border: '1.5px dashed rgba(255,204,51,0.3)',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: NURI_YELLOW_DIM, border: `1px solid rgba(255,204,51,0.3)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width={22} height={22} fill="none" stroke={NURI_YELLOW} strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  <line x1="19" y1="8" x2="19" y2="14" strokeLinecap="round"/>
                  <line x1="16" y1="11" x2="22" y2="11" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ textAlign: isRtl ? 'right' : 'left' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: NURI_YELLOW, marginBottom: 2 }}>
                  {isRtl ? 'انشئ ختمة جماعية' : 'Create a Group Khatma'}
                </p>
                <p style={{ fontSize: 11, color: TEXT_MUT }}>
                  {isRtl ? 'اختم القرآن مع أصدقائك' : 'Finish the Quran together with friends'}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* ── Group Khatmas ── */}
        {initialGroups.length > 0 && (
          <div style={{ flexShrink: 0, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 20, marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI }}>
                {isRtl ? 'ختماتي الجماعية' : 'My Group Khatmas'}
              </p>
              <button onClick={() => router.push('/tareeq/khatmati/groups')}
                style={{ fontSize: 11, color: TEXT_MUT, background: 'none', border: 'none', cursor: 'pointer' }}>
                {isRtl ? 'عرض الكل' : 'See all'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingInline: 20, paddingBottom: 6 }}>
              {initialGroups.map(g => {
                const gSurahAr = SURAH_NAMES_AR[(g.myCurrentSurah ?? 1) - 1] ?? '';
                return (
                  <div key={g.id} style={{
                    display: 'flex', flexDirection: 'column', gap: 0,
                    background: BG_CARD,
                    border: `1px solid ${g.readToday ? 'rgba(74,222,128,0.3)' : BG_CARD_BD}`,
                    borderRadius: 16, overflow: 'hidden',
                  }}>
                    {/* Info row */}
                    <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{g.name}</p>
                        <p style={{ fontSize: 11, color: TEXT_MUT }}>
                          {isRtl ? `${gSurahAr} · ص${g.myCurrentPage} · ${g.memberCount} عضو` : `${SURAH_NAMES_EN[(g.myCurrentSurah ?? 1) - 1]} · p${g.myCurrentPage} · ${g.memberCount} members`}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                        <span style={{ fontSize: 18 }}>🔥</span>
                        <span style={{ fontSize: 11, fontWeight: 900, color: g.readToday ? '#4ade80' : NURI_YELLOW }}>{g.myStreak}</span>
                      </div>
                    </div>
                    {/* Two-action CTA strip */}
                    <div style={{
                      display: 'flex', borderTop: `1px solid ${g.readToday ? 'rgba(74,222,128,0.15)' : 'rgba(255,204,51,0.1)'}`,
                    }}>
                      <button
                        onClick={() => router.push(`/tareeq/khatmati/read?page=${g.myCurrentPage}&surah=${g.myCurrentSurah}&ayah=${g.myCurrentAyah}&groupId=${g.id}`)}
                        style={{
                          flex: 1, padding: '13px 12px', border: 'none', cursor: 'pointer',
                          background: g.readToday ? 'rgba(74,222,128,0.12)' : NURI_YELLOW,
                          color: g.readToday ? '#4ade80' : '#080E1C',
                          fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                        <svg width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                        </svg>
                        {g.readToday ? (isRtl ? '✓ قرأت اليوم' : '✓ Read today') : (isRtl ? 'استمر في القراءة' : 'Continue reading')}
                      </button>
                      <button
                        onClick={() => router.push(`/tareeq/khatmati/groups/${g.id}`)}
                        style={{
                          width: 52, flexShrink: 0, border: 'none', cursor: 'pointer',
                          background: 'rgba(255,255,255,0.05)',
                          borderInlineStart: `1px solid ${g.readToday ? 'rgba(74,222,128,0.15)' : 'rgba(255,204,51,0.1)'}`,
                          color: TEXT_MUT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title={isRtl ? 'دخول المجموعة' : 'Enter group'}
                      >
                        <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── Surah picker sheet ── */}
      {showSurahPicker && (
        <div onClick={() => { setShowSurahPicker(false); setSurahSearch(''); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} dir={isRtl ? 'rtl' : 'ltr'}
            style={{ width: '100%', maxHeight: '80dvh', background: '#111827', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', animation: 'nuri-sheet 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 10px' }}>
              <p style={{ fontWeight: 800, fontSize: 16, color: NURI_YELLOW }}>{isRtl ? 'اختر سورة' : 'Choose Surah'}</p>
              <button onClick={() => { setShowSurahPicker(false); setSurahSearch(''); }}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: TEXT_MUT, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ paddingInline: 16, paddingBottom: 8 }}>
              <input value={surahSearch} onChange={e => setSurahSearch(e.target.value)}
                placeholder={isRtl ? 'ابحث عن سورة...' : 'Search surah...'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: TEXT_PRI, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredSurahs.map(({ ar, en, i }) => (
                <button key={i} ref={i + 1 === (p?.currentSurah ?? 0) ? currentSurahRef : null} onClick={() => goToSurah(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 20px', background: i + 1 === (p?.currentSurah ?? 0) ? 'rgba(255,204,51,0.06)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'start', borderBottom: '1px solid rgba(255,255,255,0.05)', borderInlineStart: i + 1 === (p?.currentSurah ?? 0) ? '3px solid #FFCC33' : undefined }}>
                  <span style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: i + 1 === (p?.currentSurah ?? 0) ? NURI_YELLOW_DIM : 'rgba(255,255,255,0.05)', border: i + 1 === (p?.currentSurah ?? 0) ? '1px solid rgba(255,204,51,0.3)' : '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: i + 1 === (p?.currentSurah ?? 0) ? NURI_YELLOW : TEXT_MUT }}>
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

      {/* ── Settings sheet ── */}
      {showSettings && (
        <div onClick={() => setShowSettings(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} dir={isRtl ? 'rtl' : 'ltr'}
            style={{ width: '100%', background: '#111827', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', animation: 'nuri-sheet 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontWeight: 800, fontSize: 16, color: NURI_YELLOW }}>{isRtl ? 'إعدادات ختمتك' : 'Khatmah Settings'}</p>
              <button onClick={() => setShowSettings(false)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: TEXT_MUT, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Daily pages */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRI, marginBottom: 10 }}>
                {isRtl ? 'صفحات الورد اليومي' : 'Daily ward pages'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRESET_PAGES.map(n => (
                  <button key={n} onClick={() => saveDailyPages(n)}
                    style={{ padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', background: dailyPages === n ? NURI_YELLOW : 'rgba(255,255,255,0.06)', color: dailyPages === n ? '#080E1C' : TEXT_MUT, border: dailyPages === n ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
                    {isRtl ? `${n} ص` : `${n}p`}
                  </button>
                ))}
              </div>

              {/* Custom pages input */}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={1} max={604}
                  value={customPages}
                  onChange={e => setCustomPages(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyCustomPages(); }}
                  placeholder={isRtl ? 'عدد مخصص...' : 'Custom number...'}
                  style={{
                    flex: 1, padding: '9px 14px', borderRadius: 10, border: `1px solid ${isCustom ? 'rgba(255,204,51,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    background: 'rgba(255,255,255,0.06)', color: TEXT_PRI, fontSize: 14, outline: 'none',
                  }}
                />
                <button onClick={applyCustomPages}
                  style={{ padding: '9px 16px', borderRadius: 10, background: NURI_YELLOW, color: '#080E1C', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                  {isRtl ? 'تطبيق' : 'Apply'}
                </button>
              </div>
              {isCustom && (
                <p style={{ fontSize: 11, color: NURI_YELLOW, marginTop: 6 }}>
                  {isRtl ? `ورد مخصص: ${dailyPages} صفحة/يوم` : `Custom: ${dailyPages} pages/day`}
                </p>
              )}
              <p style={{ fontSize: 11, color: TEXT_MUT, marginTop: 8 }}>
                {isRtl
                  ? `بهذا الورد ستختم القرآن في ${Math.ceil(TOTAL_QURAN_PAGES / dailyPages)} يوم`
                  : `At this pace, you'll finish in ${Math.ceil(TOTAL_QURAN_PAGES / dailyPages)} days`}
              </p>
            </div>

            {/* Jump to surah */}
            <button onClick={() => { setShowSettings(false); setShowSurahPicker(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 16px', borderRadius: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 10 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={1.8}>
                <path strokeLinecap="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRI }}>{isRtl ? 'انتقل إلى سورة' : 'Jump to Surah'}</span>
            </button>

            {/* Reminder toggle */}
            <button onClick={toggleReminder}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 16px', borderRadius: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 10 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRI, flex: 1 }}>{isRtl ? 'تذكير يومي' : 'Daily Reminder'}</span>
              <div style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0, background: reminderOn ? NURI_YELLOW : 'rgba(255,255,255,0.22)', transition: 'background 0.25s' }}>
                <div style={{ position: 'absolute', top: 2, left: reminderOn ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: reminderOn ? '#080E1C' : 'rgba(255,255,255,0.5)', transition: 'left 0.25s' }} />
              </div>
            </button>

            {/* Reset khatma */}
            {p && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                {!confirmReset ? (
                  <button onClick={() => setConfirmReset(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 16px', borderRadius: 12, cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(239,68,68,0.8)' }}>
                      {isRtl ? 'ابدأ ختمة جديدة من الصفحة الأولى' : 'Start a new Khatma from page 1'}
                    </span>
                  </button>
                ) : (
                  <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 10 }}>
                      {isRtl ? 'هل أنت متأكد؟ سيتم إعادة التقدم للصفحة الأولى.' : 'Are you sure? Progress will reset to page 1.'}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={resetKhatma}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 9, background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                        {isRtl ? 'نعم، أعد التشغيل' : 'Yes, restart'}
                      </button>
                      <button onClick={() => setConfirmReset(false)}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 9, background: 'rgba(255,255,255,0.07)', color: TEXT_MUT, fontWeight: 700, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                        {isRtl ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
