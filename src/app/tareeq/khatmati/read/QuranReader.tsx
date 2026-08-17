'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import {
  QuranVerse, fetchPageVerses,
  getAudioUrl, toArabicNum,
  SURAH_NAMES_AR, SURAH_NAMES_EN, TOTAL_QURAN_PAGES,
} from '@/lib/quran-data';

type Mode = 'listen' | 'read' | 'both';

function loadMode(): Mode {
  if (typeof window === 'undefined') return 'both';
  return (localStorage.getItem('khatmati-mode') as Mode) || 'both';
}

interface Props { initialPage: number; initialSurah: number; initialAyah: number; }

export default function QuranReader({ initialPage, initialSurah, initialAyah }: Props) {
  const { isRtl } = useLang();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(loadMode);
  const [page, setPage] = useState(initialPage);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0); // 0–1
  const [fontLoaded, setFontLoaded] = useState(false);

  // Refs for closure-safe access
  const versesRef   = useRef<QuranVerse[]>([]);
  const currentRef  = useRef(0);
  const playingRef  = useRef(false);
  const pageRef     = useRef(initialPage);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verseRefs   = useRef<(HTMLSpanElement | null)[]>([]);

  // Sync refs
  useEffect(() => { versesRef.current = verses; }, [verses]);
  useEffect(() => { currentRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { pageRef.current = page; }, [page]);

  // Load Amiri Quran font
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Amiri+Quran&display=swap';
    link.onload = () => setFontLoaded(true);
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // Fetch verses when page changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchPageVerses(page)
      .then(v => {
        if (cancelled) return;
        versesRef.current = v;
        setVerses(v);
        setLoading(false);
        // Restore position on initial load
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
  }, [page]);

  // Update URL and save progress when verse changes
  useEffect(() => {
    if (!verses.length) return;
    const v = verses[currentIdx];
    if (!v) return;

    // URL update (replace so back button goes to home, not every ayah)
    router.replace(`/tareeq/khatmati/read?page=${page}&surah=${v.chapter_id}&ayah=${v.verse_number}`, { scroll: false });

    // Scroll into view in mushaf mode
    verseRefs.current[currentIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Debounced progress save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/tareeq/khatmati/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPage: page, currentSurah: v.chapter_id, currentAyah: v.verse_number }),
      }).catch(() => {});
    }, 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, page, verses]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // ── Audio engine ──────────────────────────────────────────────────────────

  const playFromRef = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const verse = versesRef.current[currentRef.current];
    if (!verse) return;

    const audio = new Audio(getAudioUrl(verse.id));
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      if (audio.duration) setAudioProgress(audio.currentTime / audio.duration);
    };

    audio.onended = () => {
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
          // playFromRef() called again after verses load (see fetch effect)
        } else {
          playingRef.current = false;
          setIsPlaying(false);
        }
      }
    };

    audio.onerror = () => {
      // Skip to next on error
      const next = currentRef.current + 1;
      if (next < versesRef.current.length && playingRef.current) {
        currentRef.current = next;
        setCurrentIdx(next);
        playFromRef();
      } else {
        playingRef.current = false;
        setIsPlaying(false);
      }
    };

    audio.play().catch(() => {
      playingRef.current = false;
      setIsPlaying(false);
    });
  }, []);

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

  // Font family
  const qFont = fontLoaded
    ? "'Amiri Quran', 'Scheherazade New', 'Traditional Arabic', serif"
    : "'Scheherazade New', 'Traditional Arabic', 'Arabic Typesetting', serif";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen pb-[140px]" style={{ background: 'var(--tr-base)' }}>

      {/* ── Top bar ── */}
      <div className="fixed top-14 left-0 right-0 z-40 flex flex-col gap-0">
        {/* Page info + nav */}
        <div className="flex items-center justify-between px-4 py-2"
          style={{ background: 'var(--tr-header-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
          <button onClick={() => goPage(-1)} disabled={page <= 1}
            className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div style={{ textAlign: 'center' }}>
            <p className="text-xs font-black" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? `صفحة ${toArabicNum(page)}` : `Page ${page}`}
            </p>
            {cv && (
              <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? surahNameAr : surahNameEn}
              </p>
            )}
          </div>

          <button onClick={() => goPage(1)} disabled={page >= TOTAL_QURAN_PAGES}
            className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex" style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
          {(['listen', 'read', 'both'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              className="flex-1 py-2 text-xs font-bold transition"
              style={{
                color: mode === m ? 'var(--tr-gold)' : 'var(--tr-text-muted)',
                borderBottom: mode === m ? '2px solid var(--tr-gold)' : '2px solid transparent',
                background: 'none',
              }}>
              {m === 'listen'
                ? (isRtl ? 'استماع' : 'Listen')
                : m === 'read'
                ? (isRtl ? 'مصحف' : 'Mushaf')
                : (isRtl ? 'استماع + مصحف' : 'Listen + Read')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 pt-[104px]">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : error ? (
          <div className="text-center py-20 px-6">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--tr-text-secondary)' }}>
              {isRtl ? 'تعذّر تحميل الصفحة' : 'Failed to load page'}
            </p>
            <button onClick={() => setPage(p => p)} className="text-sm font-bold"
              style={{ color: 'var(--tr-gold)' }}>
              {isRtl ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : (
          <>
            {/* Listen mode — large single ayah */}
            {mode === 'listen' && cv && (
              <div className="flex flex-col items-center px-6 pt-10 pb-6 gap-6">
                <div dir="rtl" className="rounded-3xl p-6 w-full"
                  style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', textAlign: 'center' }}>
                  <p style={{ fontFamily: qFont, fontSize: 28, lineHeight: 2.2, color: 'var(--tr-text-primary)' }}>
                    {cv.text_uthmani}
                  </p>
                  <p className="mt-3 text-xs" style={{ color: 'var(--tr-text-muted)' }}>
                    {surahNameAr} ﴿{toArabicNum(cv.verse_number)}﴾
                  </p>
                </div>
                {/* Verse nav dots */}
                <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
                  {verses.map((_, i) => (
                    <button key={i} onClick={() => goVerse(i)}
                      style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: i === currentIdx ? 'var(--tr-gold)' : 'var(--tr-border-soft)',
                        transition: 'background 0.2s',
                      }} />
                  ))}
                </div>
              </div>
            )}

            {/* Read mode — full page */}
            {(mode === 'read' || mode === 'both') && (
              <div className="px-4 pt-4 pb-4 max-w-lg mx-auto">
                {/* Bismillah if first verse is start of surah */}
                {verses[0]?.verse_number === 1 && verses[0]?.chapter_id !== 9 && (
                  <p dir="rtl" style={{
                    fontFamily: qFont, fontSize: 22, textAlign: 'center',
                    color: 'var(--tr-text-muted)', marginBottom: 16, lineHeight: 2,
                  }}>
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                  </p>
                )}
                <div dir="rtl" style={{ fontFamily: qFont, fontSize: 22, lineHeight: 2.4, textAlign: 'justify', color: 'var(--tr-text-primary)' }}>
                  {verses.map((v, i) => (
                    <span
                      key={v.id}
                      ref={el => { verseRefs.current[i] = el; }}
                      onClick={() => { goVerse(i); }}
                      style={{
                        display: 'inline',
                        background: i === currentIdx ? 'rgba(212,168,83,0.22)' : 'transparent',
                        borderRadius: 4, padding: '0 3px',
                        cursor: 'pointer', transition: 'background 0.3s',
                        boxDecoration: 'clone',
                      }}>
                      {v.text_uthmani}
                      <span style={{ fontFamily: 'serif', fontSize: 14, color: 'var(--tr-text-muted)', margin: '0 3px', verticalAlign: 'middle' }}>
                        ﴿{toArabicNum(v.verse_number)}﴾
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Audio player (fixed bottom) ── */}
      {(mode === 'listen' || mode === 'both') && (
        <div className="fixed bottom-[60px] left-0 right-0 z-40"
          style={{
            background: 'var(--tr-surface)',
            borderTop: '1px solid var(--tr-border-soft)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.14)',
          }}>
          {/* Progress bar */}
          <div style={{ height: 3, background: 'var(--tr-overlay)' }} dir="ltr">
            <div style={{
              height: '100%', background: 'var(--tr-gold)',
              width: `${audioProgress * 100}%`, transition: 'width 0.3s linear',
            }} />
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            {/* Prev verse */}
            <button onClick={() => goVerse(currentIdx - 1)} disabled={currentIdx === 0}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Play / Pause */}
            <button onClick={togglePlay} disabled={loading}
              className="w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-40 shadow-lg"
              style={{ background: 'var(--tr-gold)', color: '#0a0c14', flexShrink: 0 }}>
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

            {/* Next verse */}
            <button onClick={() => goVerse(currentIdx + 1)} disabled={currentIdx >= verses.length - 1}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Verse info */}
            <div className="flex-1 min-w-0" dir={isRtl ? 'rtl' : 'ltr'}>
              {cv && (
                <>
                  <p className="text-sm font-black truncate" style={{ color: 'var(--tr-text-primary)' }}>
                    {isRtl ? surahNameAr : surahNameEn}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>
                    {isRtl
                      ? `الآية ${toArabicNum(cv.verse_number)} • صفحة ${toArabicNum(page)}`
                      : `Ayah ${cv.verse_number} • Page ${page}`}
                  </p>
                </>
              )}
            </div>

            {/* Back to home */}
            <button
              onClick={() => router.push('/tareeq/khatmati')}
              className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
