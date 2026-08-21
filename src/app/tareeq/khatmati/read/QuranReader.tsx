'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import MushafQCFPage from './MushafQCFPage';
import VerseActionSheet, { type TappedVerse } from './VerseActionSheet';
import {
  QuranVerse, fetchPageVerses,
  toArabicNum,
  SURAH_NAMES_AR, SURAH_NAMES_EN, TOTAL_QURAN_PAGES, SURAH_FIRST_PAGES,
  SURAH_VERSE_COUNTS, SURAH_REVELATION_TYPES,
} from '@/lib/quran-data';

type Mode = 'listen' | 'both';

const RECITERS = [
  { id: 'ar.alafasy',           nameAr: 'مشاري العفاسي',        color: '#1a6b3a' },
  { id: 'ar.husary',            nameAr: 'محمود خليل الحصري',    color: '#1a4a8a' },
  { id: 'ar.abdulbasitmurattal',nameAr: 'عبدالباسط عبدالصمد',   color: '#6b1a1a' },
  { id: 'ar.minshawi',          nameAr: 'محمد صديق المنشاوي',   color: '#5a3a00' },
  { id: 'ar.abdurrahmansudais', nameAr: 'عبدالرحمن السديس',     color: '#2a1a6b' },
  { id: 'ar.saoodshuraym',      nameAr: 'سعود الشريم',          color: '#004a4a' },
];

function getAudioUrlForReciter(globalAyahId: number, reciterId: string): string {
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${globalAyahId}.mp3`;
}

interface Props { initialPage: number; initialSurah: number; initialAyah: number; groupId?: string | null; }

export default function QuranReader({ initialPage, initialSurah, initialAyah, groupId }: Props) {
  const { isRtl } = useLang();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('listen');
  const [page, setPage] = useState(initialPage);
  const [retryKey, setRetryKey] = useState(0);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [fontLoaded, setFontLoaded] = useState(false);

  // New UI state
  const [reciterId, setReciterId] = useState('ar.alafasy');
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [surahFilter, setSurahFilter] = useState('');
  const [searchSurah, setSearchSurah] = useState(initialSurah);
  const [searchAyah, setSearchAyah] = useState(1);
  const [tappedVerse, setTappedVerse] = useState<TappedVerse | null>(null);

  // Reading mode — collapse header on scroll down in 'both' mode
  const [headerHidden, setHeaderHidden] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const lastScrollYRef = useRef(0);
  const scrollPauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Swipe-to-turn-page refs (Arabic RTL: swipe left = next, swipe right = prev)
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);

  // Refs for closure-safe access in audio callbacks
  const versesRef   = useRef<QuranVerse[]>([]);
  const currentRef  = useRef(0);
  const playingRef  = useRef(false);
  const pageRef     = useRef(initialPage);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verseRefs   = useRef<(HTMLSpanElement | null)[]>([]);
  const isMountedRef = useRef(true);

  // Read mode from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem('khatmati-mode') as Mode;
    // 'read' tab removed — fall back to listen
    if (stored === 'listen' || stored === 'both') setMode(stored);
  }, []);

  // Reading mode scroll handler — only active in 'both' tab
  useEffect(() => {
    if (mode !== 'both') { setHeaderHidden(false); return; }
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollYRef.current;
      lastScrollYRef.current = y;
      if (y < 10) { setHeaderHidden(false); return; }
      if (delta > 8) setHeaderHidden(true);
      else if (delta < -8) setHeaderHidden(false);
      // Pause auto-follow while user scrolls; resume after 4s of stillness
      setAutoFollow(false);
      if (scrollPauseRef.current) clearTimeout(scrollPauseRef.current);
      scrollPauseRef.current = setTimeout(() => setAutoFollow(true), 4000);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollPauseRef.current) clearTimeout(scrollPauseRef.current);
    };
  }, [mode]);

  // Sync state → refs so audio callbacks always read current values
  useEffect(() => { versesRef.current = verses; }, [verses]);
  useEffect(() => { currentRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { pageRef.current = page; }, [page]);

  // Load Amiri Quran font once as a page-level resource (never removed on unmount)
  useEffect(() => {
    if (document.querySelector('link[data-amiri-quran]')) {
      setFontLoaded(true);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Amiri+Quran&display=swap';
    (link as HTMLLinkElement & { dataset: DOMStringMap }).dataset.amiriQuran = '1';
    link.onload = () => setFontLoaded(true);
    document.head.appendChild(link);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      audioRef.current?.pause();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Fetch verses when page or retryKey changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchPageVerses(page)
      .then(v => {
        if (cancelled) return;
        // Reset refs array before assigning new verse elements
        verseRefs.current = new Array(v.length).fill(null);
        versesRef.current = v;
        setVerses(v);
        setLoading(false);
        if (page === initialPage) {
          const idx = v.findIndex(x => x.chapter_id === initialSurah && x.verse_number === initialAyah);
          const start = idx >= 0 ? idx : 0;
          currentRef.current = start;
          setCurrentIdx(start);
        } else {
          currentRef.current = 0;
          setCurrentIdx(0);
        }
        if (playingRef.current) playFromRef();
      })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, retryKey]);

  // URL sync + progress save when verse or page changes
  useEffect(() => {
    // Always clear debounce timer first, even if we return early
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!verses.length) return;
    const v = verses[currentIdx];
    if (!v) return;

    router.replace(
      `/tareeq/khatmati/read?page=${page}&surah=${v.chapter_id}&ayah=${v.verse_number}${groupId ? `&groupId=${groupId}` : ''}`,
      { scroll: false },
    );

    verseRefs.current[currentIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Save position to localStorage for bottom nav quick-resume
    localStorage.setItem('nuri-progress', JSON.stringify({ page, surah: v.chapter_id, ayah: v.verse_number }));

    saveTimer.current = setTimeout(() => {
      const endpoint = groupId
        ? `/api/tareeq/khatmati/groups/${groupId}/progress`
        : '/api/tareeq/khatmati/progress';
      fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPage: page,
          currentSurah: v.chapter_id,
          currentAyah: v.verse_number,
          localDate: new Date().toLocaleDateString('en-CA'),
        }),
      }).catch(() => {});
    }, 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, page, verses]);

  // ── Audio engine ──────────────────────────────────────────────────────────

  const playFromRef = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const verse = versesRef.current[currentRef.current];
    if (!verse) return;

    const audio = new Audio(getAudioUrlForReciter(verse.id, reciterId));
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      if (!isMountedRef.current) return;
      if (audio.duration) setAudioProgress(audio.currentTime / audio.duration);
    };

    audio.onended = () => {
      if (!isMountedRef.current) return;
      setAudioProgress(0);
      if (!playingRef.current) return;
      const next = currentRef.current + 1;
      if (next < versesRef.current.length) {
        currentRef.current = next;
        setCurrentIdx(next);
        playFromRef();
      } else {
        const nextPage = pageRef.current + 1;
        if (nextPage <= TOTAL_QURAN_PAGES) {
          pageRef.current = nextPage;
          setPage(nextPage);
          // playFromRef() called again after new verses load (see fetch effect)
        } else {
          playingRef.current = false;
          setIsPlaying(false);
        }
      }
    };

    audio.onerror = () => {
      if (!isMountedRef.current) return;
      const next = currentRef.current + 1;
      if (next < versesRef.current.length && playingRef.current) {
        // Skip to next verse on this page
        currentRef.current = next;
        setCurrentIdx(next);
        playFromRef();
      } else if (playingRef.current) {
        // Last verse errored — advance to next page instead of stopping
        const nextPage = pageRef.current + 1;
        if (nextPage <= TOTAL_QURAN_PAGES) {
          pageRef.current = nextPage;
          setPage(nextPage);
        } else {
          playingRef.current = false;
          setIsPlaying(false);
        }
      }
    };

    audio.play().catch(() => {
      if (!isMountedRef.current) return;
      playingRef.current = false;
      setIsPlaying(false);
    });
  }, [reciterId]);

  function togglePlay() {
    if (isPlaying) {
      audioRef.current?.pause();
      playingRef.current = false;
      setIsPlaying(false);
    } else {
      playingRef.current = true;
      setIsPlaying(true);
      playFromRef();
    }
  }

  function goVerse(idx: number) {
    if (idx < 0 || idx >= verses.length) return;
    currentRef.current = idx;
    setCurrentIdx(idx);
    setAutoFollow(true); // resume auto-follow on explicit navigation
    setHeaderHidden(false);
    if (isPlaying) playFromRef();
  }

  function goPage(delta: number) {
    const next = Math.max(1, Math.min(TOTAL_QURAN_PAGES, page + delta));
    if (next === page) return;
    audioRef.current?.pause();
    setIsPlaying(false);
    playingRef.current = false;
    setPage(next);
    // Track daily wird — each page navigation counts as one page read
    if (mode === 'both') {
      try {
        const today = new Date().toLocaleDateString('en-CA');
        const raw = localStorage.getItem('nuri-daily-progress');
        const data = raw ? JSON.parse(raw) : null;
        if (data?.date === today) {
          localStorage.setItem('nuri-daily-progress', JSON.stringify({ date: today, pagesRead: (data.pagesRead || 0) + 1 }));
        } else {
          localStorage.setItem('nuri-daily-progress', JSON.stringify({ date: today, pagesRead: 1 }));
        }
      } catch { /* ignore */ }
    }
  }

  function changeMode(m: Mode) {
    setMode(m);
    localStorage.setItem('khatmati-mode', m);
  }

  // ── Current verse info ────────────────────────────────────────────────────

  const cv = verses[currentIdx];
  const surahNameAr = SURAH_NAMES_AR[(cv?.chapter_id ?? 1) - 1] ?? '';
  const surahNameEn = SURAH_NAMES_EN[(cv?.chapter_id ?? 1) - 1] ?? '';

  const qFont = fontLoaded
    ? "'Amiri Quran', 'Scheherazade New', 'Traditional Arabic', serif"
    : "'Scheherazade New', 'Traditional Arabic', 'Arabic Typesetting', serif";


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen" style={{ background: mode === 'listen' ? '#05101f' : '#F7F2E8', overflow: mode === 'listen' ? 'hidden' : undefined }}>

      {/* ── Top bar ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex flex-col gap-0"
        style={{ transform: (mode === 'both' && headerHidden) ? 'translateY(-100%)' : 'translateY(0)', transition: 'transform 0.25s ease' }}>
        {/* Row 1: surah list (right) | page nav | search | back arrow (left) */}
        <div className="flex items-center gap-2 px-3 py-2" dir="rtl"
          style={{ background: mode === 'both' ? 'rgba(247,242,232,0.97)' : 'var(--tr-header-bg)', backdropFilter: 'blur(16px)', borderBottom: mode === 'both' ? '1px solid rgba(171,136,68,0.2)' : '1px solid var(--tr-border-subtle)' }}>

          {/* Surah list button — rightmost in RTL */}
          <button onClick={() => setShowSearch(true)}
            className="flex items-center gap-1 h-8 px-2 rounded-full shrink-0 transition active:scale-90"
            style={{ background: mode === 'both' ? 'rgba(171,136,68,0.1)' : 'var(--tr-overlay)', color: mode === 'both' ? '#5a3e10' : 'var(--tr-text-secondary)', maxWidth: 120 }}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 6h16M4 12h10M4 18h7"/>
            </svg>
            <span className="text-[11px] font-bold truncate">
              {cv ? (isRtl ? surahNameAr : surahNameEn) : (isRtl ? 'السور' : 'Surahs')}
            </span>
          </button>

          {/* Prev page */}
          <button onClick={() => goPage(-1)} disabled={page <= 1}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30 shrink-0"
            style={{ background: mode === 'both' ? 'rgba(171,136,68,0.1)' : 'var(--tr-overlay)', color: mode === 'both' ? '#5a3e10' : 'var(--tr-text-secondary)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Page + surah info (center) */}
          <div className="flex-1 text-center">
            <p className="text-xs font-black leading-none" style={{ color: mode === 'both' ? '#2e1a00' : 'var(--tr-text-primary)' }}>
              {isRtl ? `صفحة ${toArabicNum(page)}` : `Page ${page}`}
            </p>
            {cv && <p className="text-[10px] mt-0.5 leading-none" style={{ color: mode === 'both' ? '#7a5a30' : 'var(--tr-text-muted)' }}>{isRtl ? surahNameAr : surahNameEn}</p>}
          </div>

          {/* Next page */}
          <button onClick={() => goPage(1)} disabled={page >= TOTAL_QURAN_PAGES}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30 shrink-0"
            style={{ background: mode === 'both' ? 'rgba(171,136,68,0.1)' : 'var(--tr-overlay)', color: mode === 'both' ? '#5a3e10' : 'var(--tr-text-secondary)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Back button — goes to group page or nuri home */}
          <button onClick={() => router.push(groupId ? `/tareeq/khatmati/groups/${groupId}` : '/tareeq/khatmati')}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 shrink-0"
            style={{ background: mode === 'both' ? 'rgba(171,136,68,0.15)' : '#2563eb', color: mode === 'both' ? '#5a3e10' : '#fff' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        </div>

        {/* Row 2: Mode tabs — right→left: استماع | قراءة واستماع */}
        <div className="flex" style={{ background: mode === 'both' ? 'rgba(240,232,210,0.97)' : 'var(--tr-surface)', borderBottom: mode === 'both' ? '1px solid rgba(171,136,68,0.2)' : '1px solid var(--tr-border-subtle)' }}>
          {(['listen', 'both'] as Mode[]).map(m => (
            <button key={m} onClick={() => changeMode(m)}
              className="flex-1 py-2.5 text-xs font-bold transition"
              style={{
                color: mode === m ? (m === 'both' ? '#c8a84b' : 'var(--nuri-gold)') : (mode === 'both' ? '#9b7a40' : 'var(--tr-text-muted)'),
                borderBottom: mode === m ? `2px solid ${m === 'both' ? '#c8a84b' : 'var(--nuri-gold)'}` : '2px solid transparent',
                background: 'none',
              }}>
              {m === 'listen' ? (isRtl ? 'استماع' : 'Listen') : (isRtl ? 'قراءة واستماع' : 'Listen + Read')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content area ── swipe left/right to turn pages (both mode) */}
      <div className={`flex-1 ${mode === 'both' ? 'pb-[80px]' : ''}`}
        style={{ paddingTop: (mode === 'both' && headerHidden) ? 0 : 88, transition: 'padding-top 0.25s ease' }}
        onTouchStart={mode === 'both' ? (e) => { swipeStartXRef.current = e.touches[0].clientX; swipeStartYRef.current = e.touches[0].clientY; } : undefined}
        onTouchEnd={mode === 'both' ? (e) => {
          if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;
          const dx = e.changedTouches[0].clientX - swipeStartXRef.current;
          const dy = e.changedTouches[0].clientY - swipeStartYRef.current;
          swipeStartXRef.current = null; swipeStartYRef.current = null;
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          // RTL Arabic: swipe right (dx>0) = next page, swipe left = previous
          goPage(dx > 0 ? 1 : -1);
        } : undefined}>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--nuri-gold)' }} />
          </div>
        ) : error ? (
          <div className="text-center py-20 px-6">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--tr-text-secondary)' }}>
              {isRtl ? 'تعذّر تحميل الصفحة' : 'Failed to load page'}
            </p>
            <button onClick={() => setRetryKey(k => k + 1)} className="text-sm font-bold"
              style={{ color: 'var(--nuri-gold)' }}>
              {isRtl ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : (
          <>
            {/* Listen mode — fixed immersive fullscreen, no scroll, embedded controls */}
            {mode === 'listen' && cv && (
              <div className="nuri-listen-mode" style={{
                position: 'fixed', top: 88, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(160deg, #05101f 0%, #0a1e3d 45%, #071628 100%)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                zIndex: 50,
              }}>
                <style>{`
                  @keyframes nuri-wave {
                    0%,100%{height:6px;opacity:.6}
                    50%{height:var(--wh);opacity:1}
                  }
                  .nuri-listen-mode * {
                    -webkit-user-select: none !important;
                    user-select: none !important;
                    -webkit-touch-callout: none !important;
                  }
                `}</style>

                {/* ── Central content zone ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '16px 20px', overflow: 'hidden' }}>

                  {/* Headphone icon */}
                  <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                    {isPlaying && (
                      <div className="animate-ping" style={{
                        position: 'absolute', inset: -8, borderRadius: '50%',
                        background: 'rgba(59,130,246,0.15)', animationDuration: '1.8s',
                      }} />
                    )}
                    <div style={{
                      width: 96, height: 96, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1e3a6e 0%, #2563eb 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isPlaying ? '0 8px 36px rgba(37,99,235,0.55)' : '0 4px 16px rgba(37,99,235,0.25)',
                      transition: 'box-shadow 0.5s',
                    }}>
                      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 14h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z"/>
                        <path d="M19 14h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z"/>
                        <path d="M1 16v-4a11 11 0 0 1 22 0v4"/>
                      </svg>
                    </div>
                  </div>

                  {/* Sound wave bars — only visible when playing */}
                  <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 5, height: 44, flexShrink: 0 }}>
                    {[32,18,44,14,36,24,48,16,40,20,28,10,38].map((h, i) => (
                      <div key={i} style={{
                        width: 4, borderRadius: 4,
                        background: 'linear-gradient(180deg, #60a5fa, #2563eb)',
                        ['--wh' as string]: `${h}px`,
                        animation: isPlaying ? `nuri-wave ${0.7 + (i % 5) * 0.18}s ease-in-out infinite` : 'none',
                        height: isPlaying ? 6 : h * 0.3,
                        opacity: isPlaying ? 1 : 0,
                        transition: 'height 0.5s, opacity 0.5s',
                      }} />
                    ))}
                  </div>

                  {/* Reciter chip */}
                  <button onClick={() => setShowReciterPicker(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: RECITERS.find(x => x.id === reciterId)?.color ?? '#1a4a8a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff', fontWeight: 700,
                    }}>
                      {(RECITERS.find(x => x.id === reciterId)?.nameAr ?? 'م')[0]}
                    </div>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontFamily: qFont }}>
                      {RECITERS.find(x => x.id === reciterId)?.nameAr ?? ''}
                    </span>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {/* Verse text card — all touch events intercepted to block Android Google Search */}
                  <div dir="rtl"
                    onContextMenu={e => e.preventDefault()}
                    onMouseDown={e => e.preventDefault()}
                    style={{
                      background: 'rgba(255,255,255,0.06)', borderRadius: 20,
                      border: '1px solid rgba(255,255,255,0.10)',
                      padding: '18px 16px', width: '100%', maxWidth: 420,
                      textAlign: 'center',
                      WebkitUserSelect: 'none', userSelect: 'none',
                      WebkitTouchCallout: 'none',
                      flexShrink: 0, cursor: 'default',
                    }}>
                    <p style={{ fontFamily: qFont, fontSize: 22, lineHeight: 2.1, color: '#e8effe', pointerEvents: 'none' }}>
                      {cv.text_uthmani}
                    </p>
                    <p style={{ marginTop: 8, fontSize: 12, color: 'rgba(148,163,184,0.85)', pointerEvents: 'none' }}>
                      {surahNameAr} ﴿{toArabicNum(cv.verse_number)}﴾
                    </p>
                  </div>
                </div>

                {/* ── Controls zone — embedded on dark bg ── */}
                <div style={{ flexShrink: 0, paddingBottom: 'max(84px, calc(70px + env(safe-area-inset-bottom, 0px)))' }}>
                  {/* Progress bar */}
                  <div dir="ltr" style={{ height: 2, background: 'rgba(255,255,255,0.08)', marginBottom: 16, marginInline: 20, borderRadius: 999 }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                      boxShadow: '0 0 8px rgba(96,165,250,0.6)',
                      width: `${audioProgress * 100}%`, transition: 'width 0.3s linear',
                    }} />
                  </div>

                  {/* Controls row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px' }} dir="rtl">
                    {/* Prev verse */}
                    <button onClick={() => goVerse(currentIdx - 1)} disabled={currentIdx === 0}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
                      style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.7)' }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>

                    {/* Play / Pause */}
                    <button onClick={togglePlay} disabled={loading}
                      className="w-16 h-16 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-40 shadow-lg"
                      style={{ background: 'linear-gradient(135deg,#1e3a6e,#2563eb)', color: '#fff', flexShrink: 0, boxShadow: '0 4px 24px rgba(37,99,235,0.55)' }}>
                      {isPlaying ? (
                        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="4" width="4" height="16" rx="1"/>
                          <rect x="14" y="4" width="4" height="16" rx="1"/>
                        </svg>
                      ) : (
                        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>

                    {/* Next verse */}
                    <button onClick={() => goVerse(currentIdx + 1)} disabled={currentIdx >= verses.length - 1}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
                      style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.7)' }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>

                    {/* Verse info — non-selectable to prevent Android Google search panel */}
                    <div style={{ flex: 1, minWidth: 0, WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
                      onContextMenu={e => e.preventDefault()}
                      onMouseDown={e => e.preventDefault()}
                    >
                      <p style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 2, pointerEvents: 'none' }} className="truncate">
                        {isRtl ? surahNameAr : surahNameEn}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.8)', pointerEvents: 'none' }}>
                        {isRtl
                          ? `الآية ${toArabicNum(cv.verse_number)} • صفحة ${toArabicNum(page)}`
                          : `Ayah ${cv.verse_number} • Page ${page}`}
                      </p>
                    </div>

                    {/* Reciter button */}
                    {(() => {
                      const r = RECITERS.find(x => x.id === reciterId) ?? RECITERS[0];
                      return (
                        <button onClick={() => setShowReciterPicker(true)}
                          className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-black transition active:scale-90 shrink-0"
                          style={{ background: r.color, color: '#fff', border: '2px solid rgba(255,255,255,0.25)' }}>
                          {r.nameAr[0]}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Both mode — Mushaf QCF page layout */}
            {mode === 'both' && (
              <MushafQCFPage
                page={page}
                currentChapter={cv?.chapter_id ?? initialSurah}
                currentVerse={cv?.verse_number ?? initialAyah}
                autoFollow={autoFollow}
                onVerseClick={(ch, v) => {
                  const idx = versesRef.current.findIndex(x => x.chapter_id === ch && x.verse_number === v);
                  if (idx >= 0) goVerse(idx);
                }}
                onAyahTap={setTappedVerse}
              />
            )}
          </>
        )}
      </div>

      {/* ── Audio player (fixed bottom — both mode only) ── */}
      {mode === 'both' && (
        <div className="fixed bottom-0 left-0 right-0 z-40"
          style={{ background: 'rgba(240,232,210,0.97)', borderTop: '1px solid rgba(171,136,68,0.3)', boxShadow: '0 -4px 24px rgba(90,62,16,0.12)', backdropFilter: 'blur(12px)' }}>

          <div style={{ height: 3, background: 'rgba(171,136,68,0.15)' }} dir="ltr">
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #c8a84b, #e8c870)', width: `${audioProgress * 100}%`, transition: 'width 0.3s linear' }} />
          </div>

          <div className="flex items-center gap-3 px-4 py-3" dir="rtl">
            <button onClick={() => goVerse(currentIdx - 1)} disabled={currentIdx === 0}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
              style={{ background: 'rgba(171,136,68,0.12)', color: '#5a3e10' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            <button onClick={togglePlay} disabled={loading}
              className="w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-40 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #c8a84b, #e8c870)', color: '#1a0800', flexShrink: 0, boxShadow: '0 4px 16px rgba(200,168,75,0.4)' }}>
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <button onClick={() => goVerse(currentIdx + 1)} disabled={currentIdx >= verses.length - 1}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
              style={{ background: 'rgba(171,136,68,0.12)', color: '#5a3e10' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {cv && (
              <div className="flex-1 min-w-0"
                style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
                onContextMenu={e => e.preventDefault()}
                onMouseDown={e => e.preventDefault()}
              >
                <p className="text-sm font-black truncate" style={{ color: '#2e1a00', pointerEvents: 'none' }}>
                  {isRtl ? surahNameAr : surahNameEn}
                </p>
                <p className="text-xs" style={{ color: '#9b7a40', pointerEvents: 'none' }}>
                  {isRtl
                    ? `الآية ${toArabicNum(cv.verse_number)} • صفحة ${toArabicNum(page)}`
                    : `Ayah ${cv.verse_number} • Page ${page}`}
                </p>
              </div>
            )}
            {/* Reciter button */}
            {(() => {
              const r = RECITERS.find(x => x.id === reciterId) ?? RECITERS[0];
              return (
                <button onClick={() => setShowReciterPicker(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black transition active:scale-90 shrink-0"
                  style={{ background: r.color, color: '#fff', border: '2px solid rgba(255,255,255,0.2)' }}>
                  {r.nameAr[0]}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Reciter picker modal ── */}
      {showReciterPicker && (
        <div onClick={() => setShowReciterPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: 'var(--tr-surface)', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', width: '100%', maxWidth: 480 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--tr-border-soft)', margin: '0 auto 18px' }} />
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--tr-text-primary)', marginBottom: 16 }}>اختيار القارئ</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RECITERS.map(r => (
                <button key={r.id} onClick={() => { setReciterId(r.id); setShowReciterPicker(false); audioRef.current?.pause(); setIsPlaying(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 14, cursor: 'pointer', width: '100%', textAlign: 'right',
                  background: reciterId === r.id ? 'rgba(37,99,235,0.12)' : 'var(--tr-raised)',
                  border: reciterId === r.id ? '1.5px solid #2563eb' : '1px solid var(--tr-border-soft)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: '#fff', fontWeight: 700,
                  }}>
                    {r.nameAr[0]}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: reciterId === r.id ? 700 : 500, color: reciterId === r.id ? '#2563eb' : 'var(--tr-text-primary)', fontFamily: qFont }}>
                    {r.nameAr}
                  </span>
                  {reciterId === r.id && (
                    <svg style={{ marginRight: 'auto' }} width={18} height={18} viewBox="0 0 24 24" fill="#2563eb">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Surah picker modal — full scrollable list ── */}
      {showSearch && (
        <div onClick={() => { setShowSearch(false); setSurahFilter(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} dir="rtl"
            style={{ background: 'var(--tr-surface)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '88dvh' }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--tr-border-soft)', margin: '14px auto 0', flexShrink: 0 }} />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 0', flexShrink: 0 }}>
              <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--tr-text-primary)' }}>
                {isRtl ? 'قائمة السور' : 'Surah List'}
              </p>
              <button onClick={() => { setShowSearch(false); setSurahFilter(''); }}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--tr-overlay)', border: 'none', cursor: 'pointer', color: 'var(--tr-text-muted)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
            {/* Search bar */}
            <div style={{ padding: '10px 16px 8px', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--tr-text-muted)" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
                </svg>
                <input
                  value={surahFilter}
                  onChange={e => setSurahFilter(e.target.value)}
                  placeholder={isRtl ? 'ابحث باسم السورة أو رقمها...' : 'Search by name or number...'}
                  style={{
                    width: '100%', padding: '10px 38px 10px 14px', borderRadius: 12,
                    background: 'var(--tr-raised)', color: 'var(--tr-text-primary)',
                    border: '1px solid var(--tr-border-soft)', outline: 'none', fontSize: 14,
                    boxSizing: 'border-box', textAlign: 'right',
                  }}
                />
              </div>
            </div>
            {/* Surah list */}
            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 24 }}>
              {SURAH_NAMES_AR
                .map((ar, i) => ({ ar, en: SURAH_NAMES_EN[i], i, num: i + 1 }))
                .filter(s =>
                  surahFilter === '' ||
                  s.ar.includes(surahFilter) ||
                  s.en.toLowerCase().includes(surahFilter.toLowerCase()) ||
                  String(s.num).includes(surahFilter)
                )
                .map(({ ar, en, i, num }) => {
                  const isCurrent = cv ? cv.chapter_id === num : false;
                  const revType = SURAH_REVELATION_TYPES[i];
                  const verseCount = SURAH_VERSE_COUNTS[i];
                  return (
                    <button key={i}
                      onClick={() => {
                        const targetPage = SURAH_FIRST_PAGES[i];
                        if (targetPage) {
                          audioRef.current?.pause();
                          setIsPlaying(false);
                          playingRef.current = false;
                          setPage(targetPage);
                        }
                        setShowSearch(false);
                        setSurahFilter('');
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        width: '100%', padding: '11px 20px', border: 'none',
                        cursor: 'pointer', textAlign: 'right',
                        borderBottom: '1px solid var(--tr-border-subtle)',
                        background: isCurrent ? 'rgba(212,168,83,0.07)' : 'transparent',
                      }}>
                      {/* Surah number badge */}
                      <span style={{
                        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                        background: isCurrent ? 'rgba(212,168,83,0.18)' : 'var(--tr-overlay)',
                        border: isCurrent ? '1.5px solid rgba(212,168,83,0.55)' : '1px solid var(--tr-border-soft)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                        color: isCurrent ? 'var(--nuri-gold)' : 'var(--tr-text-muted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {num}
                      </span>
                      {/* Names */}
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: isCurrent ? 'var(--nuri-gold)' : 'var(--tr-text-primary)', marginBottom: 2, fontFamily: qFont }}>
                          {ar}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--tr-text-muted)' }}>{en}</p>
                      </div>
                      {/* Meta: type + verse count */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                          background: revType === 'م' ? 'rgba(37,99,235,0.12)' : 'rgba(16,185,129,0.12)',
                          color: revType === 'م' ? '#60a5fa' : '#34d399',
                        }}>
                          {revType === 'م' ? 'مكية' : 'مدنية'}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--tr-text-muted)', paddingInlineStart: 2 }}>
                          {verseCount} آية
                        </span>
                      </div>
                      {/* Current indicator */}
                      {isCurrent && (
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="var(--nuri-gold)" style={{ flexShrink: 0 }}>
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
      {/* Verse action sheet — tafsir + card */}
      {tappedVerse && (
        <VerseActionSheet verse={tappedVerse} onClose={() => setTappedVerse(null)} />
      )}
    </div>
  );
}
