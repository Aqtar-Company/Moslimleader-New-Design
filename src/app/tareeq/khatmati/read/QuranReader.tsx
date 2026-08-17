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

interface Props { initialPage: number; initialSurah: number; initialAyah: number; }

export default function QuranReader({ initialPage, initialSurah, initialAyah }: Props) {
  const { isRtl } = useLang();
  const router = useRouter();

  // Initialize to 'both' to avoid SSR/hydration mismatch; real value loaded in useEffect
  const [mode, setMode] = useState<Mode>('both');
  const [page, setPage] = useState(initialPage);
  const [retryKey, setRetryKey] = useState(0);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [fontLoaded, setFontLoaded] = useState(false);
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
    if (stored === 'listen' || stored === 'read' || stored === 'both') setMode(stored);
  }, []);

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

    const audio = new Audio(getAudioUrl(verse.id));
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

  const qFont = fontLoaded
    ? "'Amiri Quran', 'Scheherazade New', 'Traditional Arabic', serif"
    : "'Scheherazade New', 'Traditional Arabic', 'Arabic Typesetting', serif";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen pb-[80px]" style={{ background: 'var(--tr-base)' }}>

      {/* ── Top bar ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex flex-col gap-0">
        {/* Page info + nav — RTL: right=prev, left=next (Arabic book order) */}
        <div className="flex items-center justify-between px-4 py-2" dir="rtl"
          style={{ background: 'var(--tr-header-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
          {/* Right side = previous page (going backward = toward start of mushaf) */}
          <button onClick={() => goPage(-1)} disabled={page <= 1}
            className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
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

          {/* Left side = next page (going forward = toward end of mushaf) */}
          <button onClick={() => goPage(1)} disabled={page >= TOTAL_QURAN_PAGES}
            className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
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
                color: mode === m ? 'var(--nuri-gold)' : 'var(--tr-text-muted)',
                borderBottom: mode === m ? '2px solid var(--nuri-gold)' : '2px solid transparent',
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
      <div className="flex-1 pt-[88px]">
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
            {/* Listen mode — large single ayah, centered vertically */}
            {mode === 'listen' && cv && (
              <div className="flex flex-col items-center justify-center px-6 gap-6"
                style={{ minHeight: 'calc(100vh - 168px)' }}>
                <div dir="rtl" className="rounded-3xl p-6 w-full"
                  style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', textAlign: 'center', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}>
                  <p style={{ fontFamily: qFont, fontSize: 28, lineHeight: 2.2, color: 'var(--tr-text-primary)' }}>
                    {cv.text_uthmani}
                  </p>
                  <p className="mt-3 text-xs" style={{ color: 'var(--tr-text-muted)' }}>
                    {surahNameAr} ﴿{toArabicNum(cv.verse_number)}﴾
                  </p>
                </div>
                {/* Verse counter — RTL: right=prev, left=next */}
                <div className="flex items-center gap-4" dir="rtl">
                  {/* Right in RTL = prev verse */}
                  <button onClick={() => goVerse(currentIdx - 1)} disabled={currentIdx === 0}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
                    style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                  <p className="text-sm font-bold" style={{ color: 'var(--tr-text-muted)', minWidth: 64, textAlign: 'center' }}>
                    {isRtl
                      ? `${toArabicNum(currentIdx + 1)} / ${toArabicNum(verses.length)}`
                      : `${currentIdx + 1} / ${verses.length}`}
                  </p>
                  {/* Left in RTL = next verse */}
                  <button onClick={() => goVerse(currentIdx + 1)} disabled={currentIdx >= verses.length - 1}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
                    style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Read mode — mushaf-style page (typeset, no CDN needed) */}
            {mode === 'read' && (
              <div className="px-3 py-4 flex justify-center">
                {/* Outer gold frame */}
                <div style={{
                  maxWidth: 480, width: '100%',
                  background: '#fdf8f2',
                  border: '2px solid #b8943c',
                  borderRadius: 6,
                  boxShadow: '0 6px 32px rgba(0,0,0,0.18), inset 0 0 60px rgba(184,148,60,0.05)',
                  padding: 3,
                }}>
                  {/* Inner border */}
                  <div style={{
                    border: '1px solid rgba(184,148,60,0.5)',
                    borderRadius: 4,
                    padding: '22px 18px 20px',
                    minHeight: 560,
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    {/* Surah name banner — shown when page opens a new surah */}
                    {verses[0]?.verse_number === 1 && (
                      <div style={{ textAlign: 'center', marginBottom: 14 }}>
                        <div style={{
                          display: 'inline-block',
                          border: '1px solid #c8a44a',
                          borderRadius: 4,
                          padding: '5px 28px',
                          background: 'linear-gradient(90deg, transparent, rgba(184,148,60,0.12), transparent)',
                          color: '#5a3500',
                          fontFamily: "'Amiri', 'Traditional Arabic', serif",
                          fontSize: 17,
                          fontWeight: 700,
                          letterSpacing: 1,
                        }}>
                          سورة {surahNameAr}
                        </div>
                      </div>
                    )}

                    {/* Bismillah */}
                    {verses[0]?.verse_number === 1
                      && verses[0]?.chapter_id !== 9
                      && verses[0]?.chapter_id !== 1 && (
                      <p dir="rtl" style={{
                        fontFamily: qFont, fontSize: 21, textAlign: 'center',
                        color: '#2a1200', marginBottom: 14, lineHeight: 2.2,
                        WebkitUserSelect: 'none', userSelect: 'none',
                      }}>
                        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                      </p>
                    )}

                    {/* Flowing verse text — all verses on one continuous page */}
                    <div dir="rtl" style={{
                      fontFamily: qFont,
                      fontSize: 22,
                      lineHeight: 2.9,
                      textAlign: 'center',
                      color: '#150800',
                      flex: 1,
                      WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
                    }}>
                      {verses.map((v, i) => (
                        <span
                          key={v.id}
                          ref={el => { verseRefs.current[i] = el; }}
                          onClick={() => goVerse(i)}
                          style={{
                            display: 'inline',
                            background: i === currentIdx ? 'rgba(184,148,60,0.22)' : 'transparent',
                            borderRadius: 3,
                            cursor: 'pointer',
                            transition: 'background 0.25s',
                          }}>
                          {v.text_uthmani}
                          {/* Circular verse-end marker like real mushaf */}
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24, height: 24,
                            borderRadius: '50%',
                            border: '1px solid #b8943c',
                            color: '#7a5010',
                            fontSize: 10,
                            fontFamily: 'serif',
                            margin: '0 4px',
                            verticalAlign: 'middle',
                            flexShrink: 0,
                            lineHeight: 1,
                          }}>
                            {toArabicNum(v.verse_number)}
                          </span>
                        </span>
                      ))}
                    </div>

                    {/* Page number at bottom */}
                    <p style={{
                      textAlign: 'center', marginTop: 14,
                      color: '#8a6020', fontSize: 14,
                      fontFamily: "'Amiri', serif",
                    }}>
                      ﴿ {toArabicNum(page)} ﴾
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Both mode — full text page */}
            {mode === 'both' && (
              <div className="px-4 pt-4 pb-4 max-w-lg mx-auto">
                {verses[0]?.verse_number === 1
                  && verses[0]?.chapter_id !== 9
                  && verses[0]?.chapter_id !== 1 && (
                  <p dir="rtl" style={{
                    fontFamily: qFont, fontSize: 22, textAlign: 'center',
                    color: 'var(--tr-text-muted)', marginBottom: 16, lineHeight: 2,
                    WebkitUserSelect: 'none', userSelect: 'none',
                  }}>
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                  </p>
                )}
                <div dir="rtl" style={{ fontFamily: qFont, fontSize: 22, lineHeight: 2.4, textAlign: 'justify', color: 'var(--tr-text-primary)', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}>
                  {verses.map((v, i) => (
                    <span
                      key={v.id}
                      ref={el => { verseRefs.current[i] = el; }}
                      onClick={() => { goVerse(i); }}
                      style={{
                        display: 'inline',
                        background: i === currentIdx ? 'rgba(255,204,0,0.20)' : 'transparent',
                        borderRadius: 4, padding: '0 3px',
                        cursor: 'pointer', transition: 'background 0.3s',
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
        <div className="fixed bottom-0 left-0 right-0 z-40"
          style={{
            background: 'var(--tr-surface)',
            borderTop: '1px solid var(--tr-border-soft)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.14)',
          }}>
          {/* Progress bar */}
          <div style={{ height: 3, background: 'var(--tr-overlay)' }} dir="ltr">
            <div style={{
              height: '100%', background: 'var(--nuri-gold)',
              width: `${audioProgress * 100}%`, transition: 'width 0.3s linear',
            }} />
          </div>

          {/* RTL: right=prev ayah, left=next ayah (Arabic reading order) */}
          <div className="flex items-center gap-3 px-4 py-3" dir="rtl">
            {/* Right side = prev verse (going back = toward start) */}
            <button onClick={() => goVerse(currentIdx - 1)} disabled={currentIdx === 0}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Play / Pause */}
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

            {/* Left side = next verse (going forward = toward end) */}
            <button onClick={() => goVerse(currentIdx + 1)} disabled={currentIdx >= verses.length - 1}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Verse info */}
            <div className="flex-1 min-w-0">
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

            {/* Back to home (leftmost in RTL) */}
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
