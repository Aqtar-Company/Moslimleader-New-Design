'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import {
  QuranVerse, fetchPageVerses,
  toArabicNum,
  SURAH_NAMES_AR, SURAH_NAMES_EN, TOTAL_QURAN_PAGES, SURAH_FIRST_PAGES,
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

interface Props { initialPage: number; initialSurah: number; initialAyah: number; }

export default function QuranReader({ initialPage, initialSurah, initialAyah }: Props) {
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
  const [mushafLines, setMushafLines] = useState<{ lineNum: number; words: { text: string; codeV1: string; charType: string; verseNumber: number; chapterId: number }[] }[]>([]);
  const [mushafLinesLoading, setMushafLinesLoading] = useState(false);
  const [qcfFontName, setQcfFontName] = useState<string | null>(null);

  // New UI state
  const [reciterId, setReciterId] = useState('ar.alafasy');
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchSurah, setSearchSurah] = useState(initialSurah);
  const [searchAyah, setSearchAyah] = useState(1);

  // Refs for closure-safe access in audio callbacks
  const versesRef   = useRef<QuranVerse[]>([]);
  const currentRef  = useRef(0);
  const playingRef  = useRef(false);
  const pageRef     = useRef(initialPage);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verseRefs   = useRef<(HTMLSpanElement | null)[]>([]);
  const isMountedRef = useRef(true);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Read mode from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem('khatmati-mode') as Mode;
    // 'read' tab removed — fall back to listen
    if (stored === 'listen' || stored === 'both') setMode(stored);
  }, []);

  // Fetch mushaf line data + load per-page QCF4 font when in both mode
  useEffect(() => {
    if (mode !== 'both') return;
    let cancelled = false;
    setMushafLines([]);
    setMushafLinesLoading(true);
    setQcfFontName(null);

    const fontName = `QCF4_P${String(page).padStart(3, '0')}`;

    // Load QCF4 per-page Madinah Mushaf font (proxied through our server)
    const loadFont = async () => {
      if (document.fonts && !document.fonts.check(`1em ${fontName}`)) {
        try {
          const face = new FontFace(fontName, `url(/api/tareeq/quran/qcf-font?page=${page})`);
          await face.load();
          document.fonts.add(face);
        } catch {
          // Font failed — fall back to Amiri Quran
        }
      }
      if (!cancelled) setQcfFontName(fontName);
    };

    Promise.all([
      fetch(`/api/tareeq/quran/mushaf-lines?page=${page}`)
        .then(r => r.json())
        .then(d => { if (!cancelled) { setMushafLines(d.lines ?? []); setMushafLinesLoading(false); } })
        .catch(() => { if (!cancelled) setMushafLinesLoading(false); }),
      loadFont(),
    ]);

    return () => { cancelled = true; };
  }, [page, mode]);

  // Sync state → refs so audio callbacks always read current values
  useEffect(() => { versesRef.current = verses; }, [verses]);
  useEffect(() => { currentRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { pageRef.current = page; }, [page]);

  // Auto-scroll to active line in both mode when verse changes
  useEffect(() => {
    if (mode === 'both' && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentIdx, mode]);

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
      `/tareeq/khatmati/read?page=${page}&surah=${v.chapter_id}&ayah=${v.verse_number}`,
      { scroll: false },
    );

    verseRefs.current[currentIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Save position to localStorage for bottom nav quick-resume
    localStorage.setItem('nuri-progress', JSON.stringify({ page, surah: v.chapter_id, ayah: v.verse_number }));

    saveTimer.current = setTimeout(() => {
      fetch('/api/tareeq/khatmati/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPage: page,
          currentSurah: v.chapter_id,
          currentAyah: v.verse_number,
          localDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD in user's timezone
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
    if (isPlaying) playFromRef();
  }

  function goPage(delta: number) {
    const next = Math.max(1, Math.min(TOTAL_QURAN_PAGES, page + delta));
    if (next === page) return;
    audioRef.current?.pause();
    setIsPlaying(false);
    playingRef.current = false;
    setPage(next);
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

  // QCF4 font is page-specific — use it for mushaf mode when loaded, else fall back to Amiri
  const mushafFont = qcfFontName
    ? `'${qcfFontName}', 'Amiri Quran', 'Scheherazade New', serif`
    : qFont;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen" style={{ background: mode === 'listen' ? '#05101f' : 'var(--tr-base)', overflow: mode === 'listen' ? 'hidden' : undefined }}>

      {/* ── Top bar ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex flex-col gap-0">
        {/* Row 1: reciter (right) | page nav | search | back arrow (left) */}
        <div className="flex items-center gap-2 px-3 py-2" dir="rtl"
          style={{ background: 'var(--tr-header-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--tr-border-subtle)' }}>

          {/* Reciter avatar — rightmost in RTL */}
          {(() => {
            const r = RECITERS.find(x => x.id === reciterId) ?? RECITERS[0];
            return (
              <button onClick={() => setShowReciterPicker(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition active:scale-90 shrink-0"
                style={{ background: r.color, color: '#fff', border: '2px solid rgba(255,255,255,0.3)' }}
                title={r.nameAr}>
                {r.nameAr[0]}
              </button>
            );
          })()}

          {/* Prev page */}
          <button onClick={() => goPage(-1)} disabled={page <= 1}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30 shrink-0"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Page + surah info (center) */}
          <div className="flex-1 text-center">
            <p className="text-xs font-black leading-none" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? `صفحة ${toArabicNum(page)}` : `Page ${page}`}
            </p>
            {cv && <p className="text-[10px] mt-0.5 leading-none" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? surahNameAr : surahNameEn}</p>}
          </div>

          {/* Next page */}
          <button onClick={() => goPage(1)} disabled={page >= TOTAL_QURAN_PAGES}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30 shrink-0"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Search */}
          <button onClick={() => setShowSearch(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 shrink-0"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>

          {/* Back → Nuri home — leftmost in RTL, arrow points right */}
          <button onClick={() => router.push('/tareeq/khatmati')}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 shrink-0"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>

        {/* Row 2: Mode tabs — right→left: استماع | قراءة واستماع */}
        <div className="flex" style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
          {(['listen', 'both'] as Mode[]).map(m => (
            <button key={m} onClick={() => changeMode(m)}
              className="flex-1 py-2.5 text-xs font-bold transition"
              style={{
                color: mode === m ? 'var(--nuri-gold)' : 'var(--tr-text-muted)',
                borderBottom: mode === m ? '2px solid var(--nuri-gold)' : '2px solid transparent',
                background: 'none',
              }}>
              {m === 'listen' ? (isRtl ? 'استماع' : 'Listen') : (isRtl ? 'قراءة واستماع' : 'Listen + Read')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className={`flex-1 pt-[88px] ${mode === 'both' ? 'pb-[80px]' : ''}`}>
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
              <div style={{
                position: 'fixed', top: 88, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(160deg, #05101f 0%, #0a1e3d 45%, #071628 100%)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                <style>{`
                  @keyframes nuri-wave {
                    0%,100%{height:6px;opacity:.6}
                    50%{height:var(--wh);opacity:1}
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

                  {/* Verse text card */}
                  <div dir="rtl" style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.10)',
                    padding: '18px 16px', width: '100%', maxWidth: 420,
                    textAlign: 'center', WebkitUserSelect: 'none', userSelect: 'none',
                    flexShrink: 0,
                  }}>
                    <p style={{ fontFamily: qFont, fontSize: 22, lineHeight: 2.1, color: '#e8effe' }}>
                      {cv.text_uthmani}
                    </p>
                    <p style={{ marginTop: 8, fontSize: 12, color: 'rgba(148,163,184,0.85)' }}>
                      {surahNameAr} ﴿{toArabicNum(cv.verse_number)}﴾
                    </p>
                  </div>
                </div>

                {/* ── Controls zone — embedded on dark bg ── */}
                <div style={{ flexShrink: 0, paddingBottom: 28 }}>
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

                    {/* Verse info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 2 }} className="truncate">
                        {isRtl ? surahNameAr : surahNameEn}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.8)' }}>
                        {isRtl
                          ? `الآية ${toArabicNum(cv.verse_number)} • صفحة ${toArabicNum(page)}`
                          : `Ayah ${cv.verse_number} • Page ${page}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Both mode — line-by-line mushaf layout with audio player overlay */}
            {mode === 'both' && (
              <div style={{ padding: '12px 4px 100px', display: 'flex', justifyContent: 'center' }}>
                {/* Outer frame — Madinah Mushaf paper */}
                <div style={{
                  width: '100%', maxWidth: 520,
                  background: '#faf9f4',
                  border: '2.5px solid #1a1a1a',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
                }}>
                  {/* Inner gold line */}
                  <div style={{ border: '1px solid #b8973a', margin: 4, padding: '12px 8px 10px' }}>

                    {/* Surah name header */}
                    {verses[0]?.verse_number === 1 && (
                      <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <div style={{
                          display: 'inline-block',
                          border: '1.5px solid #1a1a1a', borderRadius: 1,
                          padding: '3px 0', width: '88%', background: '#faf9f4', position: 'relative',
                        }}>
                          <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#444' }}>❧</span>
                          <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#444' }}>❦</span>
                          <span style={{ fontFamily: qFont, fontSize: 17, fontWeight: 700, color: '#111', display: 'block', lineHeight: 1.9 }}>
                            سورة {surahNameAr}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Spinner while loading mushaf lines */}
                    {mushafLinesLoading && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 380 }}>
                        <div className="w-6 h-6 border-2 rounded-full animate-spin"
                          style={{ borderColor: '#ccc', borderTopColor: '#555' }} />
                      </div>
                    )}

                    {/* Lines — QCF4 per-page font (pixel-perfect Madinah Mushaf) */}
                    {!mushafLinesLoading && mushafLines.length > 0 && (
                      <div dir="rtl" style={{
                        fontFamily: mushafFont,
                        fontSize: 17,
                        color: '#0a0a0a',
                        WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
                      }}>
                        {mushafLines.map(line => {
                          const wordCount = line.words.filter(w => w.charType !== 'end').length;
                          const justify = wordCount <= 2 ? 'center' : 'space-between';
                          const useQcf = !!qcfFontName;
                          // Check if this line contains the currently playing verse
                          const lineHasActive = line.words.some(w => {
                            const vIdx = verses.findIndex(v => v.verse_number === w.verseNumber && v.chapter_id === w.chapterId);
                            return vIdx === currentIdx;
                          });
                          return (
                            <div key={line.lineNum}
                              ref={lineHasActive ? activeLineRef : null}
                              style={{
                                display: 'flex',
                                justifyContent: justify,
                                alignItems: 'center',
                                flexWrap: 'nowrap',
                                lineHeight: 2.6,
                                overflow: 'hidden',
                                borderRadius: lineHasActive ? 4 : 0,
                                background: lineHasActive ? 'rgba(212,168,83,0.10)' : 'transparent',
                                transition: 'background 0.3s',
                              }}>
                              {line.words.map((w, wi) => {
                                if (w.charType === 'end') {
                                  if (useQcf && w.codeV1) {
                                    const vIdx2 = verses.findIndex(v => v.verse_number === w.verseNumber && v.chapter_id === w.chapterId);
                                    const isActive = vIdx2 === currentIdx;
                                    return (
                                      <span key={wi} style={{ flexShrink: 0, cursor: 'pointer', color: isActive ? '#b8860b' : undefined }}
                                        onClick={() => { if (vIdx2 >= 0) goVerse(vIdx2); }}>
                                        {w.codeV1}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span key={wi} style={{
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: 24, height: 24, borderRadius: '50%',
                                      border: '1.5px solid #b8860b',
                                      color: '#b8860b', fontSize: 9,
                                      fontFamily: 'serif', flexShrink: 0,
                                      margin: '0 2px', cursor: 'pointer',
                                    }}
                                      onClick={() => {
                                        const idx = verses.findIndex(v => v.verse_number === w.verseNumber && v.chapter_id === w.chapterId);
                                        if (idx >= 0) goVerse(idx);
                                      }}>
                                      {toArabicNum(w.verseNumber)}
                                    </span>
                                  );
                                }
                                const vIdx = verses.findIndex(v => v.verse_number === w.verseNumber && v.chapter_id === w.chapterId);
                                const isActive = vIdx === currentIdx;
                                return (
                                  <span key={wi}
                                    style={{
                                      background: isActive ? 'rgba(212,168,83,0.25)' : 'transparent',
                                      borderRadius: 2, cursor: 'pointer',
                                      transition: 'background 0.2s', flexShrink: 0,
                                      color: isActive ? '#7a5800' : undefined,
                                    }}
                                    onClick={() => { if (vIdx >= 0) goVerse(vIdx); }}>
                                    {useQcf && w.codeV1 ? w.codeV1 : w.text}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Fallback if mushaf lines API fails */}
                    {!mushafLinesLoading && mushafLines.length === 0 && verses.length > 0 && (
                      <div dir="rtl" style={{
                        fontFamily: qFont, fontSize: 17, lineHeight: 2.8,
                        textAlign: 'center', color: '#0a0a0a',
                        WebkitUserSelect: 'none', userSelect: 'none',
                      }}>
                        {verses.map((v, i) => (
                          <span key={v.id}
                            ref={el => { verseRefs.current[i] = el; }}
                            onClick={() => goVerse(i)}
                            style={{
                              display: 'inline',
                              background: i === currentIdx ? 'rgba(212,168,83,0.20)' : 'transparent',
                              borderRadius: 2, cursor: 'pointer', transition: 'background 0.2s',
                            }}>
                            {v.text_uthmani}
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 22, height: 22, borderRadius: '50%',
                              border: '1.5px solid #b8860b', color: '#b8860b',
                              fontSize: 9, margin: '0 3px', verticalAlign: 'middle',
                            }}>
                              {toArabicNum(v.verse_number)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Page number */}
                    <p style={{ textAlign: 'center', marginTop: 8, color: '#666', fontSize: 13, fontFamily: qFont }}>
                      {toArabicNum(page)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Audio player (fixed bottom — both mode only) ── */}
      {mode === 'both' && (
        <div className="fixed bottom-0 left-0 right-0 z-40"
          style={{ background: 'var(--tr-surface)', borderTop: '1px solid var(--tr-border-soft)', boxShadow: '0 -4px 24px rgba(0,0,0,0.14)' }}>

          <div style={{ height: 3, background: 'var(--tr-overlay)' }} dir="ltr">
            <div style={{ height: '100%', background: 'var(--nuri-gold)', width: `${audioProgress * 100}%`, transition: 'width 0.3s linear' }} />
          </div>

          <div className="flex items-center gap-3 px-4 py-3" dir="rtl">
            <button onClick={() => goVerse(currentIdx - 1)} disabled={currentIdx === 0}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            <button onClick={togglePlay} disabled={loading}
              className="w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-40 shadow-lg"
              style={{ background: 'var(--nuri-gold)', color: '#0a0c14', flexShrink: 0 }}>
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
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {cv && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate" style={{ color: 'var(--tr-text-primary)' }}>
                  {isRtl ? surahNameAr : surahNameEn}
                </p>
                <p className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>
                  {isRtl
                    ? `الآية ${toArabicNum(cv.verse_number)} • صفحة ${toArabicNum(page)}`
                    : `Ayah ${cv.verse_number} • Page ${page}`}
                </p>
              </div>
            )}
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

      {/* ── Search modal (surah + ayah jump) ── */}
      {showSearch && (
        <div onClick={() => setShowSearch(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: 'var(--tr-surface)', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', width: '100%', maxWidth: 480 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--tr-border-soft)', margin: '0 auto 18px' }} />
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--tr-text-primary)', marginBottom: 16 }}>الانتقال إلى سورة / آية</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Surah select */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--tr-text-muted)', marginBottom: 6, display: 'block' }}>السورة</label>
                <select
                  value={searchSurah}
                  onChange={e => setSearchSurah(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
                    background: 'var(--tr-raised)', color: 'var(--tr-text-primary)',
                    border: '1px solid var(--tr-border-soft)', outline: 'none',
                    fontFamily: qFont, direction: 'rtl',
                  }}>
                  {SURAH_NAMES_AR.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}. {name}</option>
                  ))}
                </select>
              </div>
              {/* Ayah number */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--tr-text-muted)', marginBottom: 6, display: 'block' }}>رقم الآية</label>
                <input
                  type="number" min={1} value={searchAyah}
                  onChange={e => setSearchAyah(Math.max(1, Number(e.target.value)))}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
                    background: 'var(--tr-raised)', color: 'var(--tr-text-primary)',
                    border: '1px solid var(--tr-border-soft)', outline: 'none', textAlign: 'right',
                  }} />
              </div>
              <button
                onClick={() => {
                  const targetPage = SURAH_FIRST_PAGES[searchSurah - 1];
                  if (targetPage) { setPage(targetPage); }
                  setShowSearch(false);
                }}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 14,
                  background: 'var(--nuri-gold)', color: '#0a0c14', border: 'none', cursor: 'pointer',
                }}>
                انتقال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
