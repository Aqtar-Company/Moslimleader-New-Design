'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import MushafCarousel from './MushafCarousel';
import VerseActionSheet, { type TappedVerse } from './VerseActionSheet';
import { fetchAndCachePage, fetchSurahHeaderGlyphs, getCachedPage } from './mushafCache';
import type { MushafWord } from './mushafCache';
import { loadQcfFont, QBSML_FONT } from './qcfFonts';
import {
  QuranVerse, fetchPageVerses,
  toArabicNum,
  SURAH_NAMES_AR, SURAH_NAMES_EN, TOTAL_QURAN_PAGES, SURAH_FIRST_PAGES,
  SURAH_VERSE_COUNTS, SURAH_REVELATION_TYPES,
} from '@/lib/quran-data';

type Mode = 'listen' | 'both';

// Surah name rendered with the same QBSML calligraphy glyph used for
// in-Mushaf surah header frames — falls back to plain text while the glyph
// set loads (or for any surah missing from it, which shouldn't happen).
function SurahHeaderName({ surahNum, fallback }: { surahNum: number; fallback: string }) {
  const [glyph, setGlyph] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSurahHeaderGlyphs(), loadQcfFont(QBSML_FONT)]).then(([map]) => {
      if (!cancelled) setGlyph(map.get(surahNum) ?? null);
    });
    return () => { cancelled = true; };
  }, [surahNum]);

  if (glyph) {
    return <span style={{ fontFamily: `"${QBSML_FONT}"`, fontSize: 17 }} translate="no">{glyph}</span>;
  }
  return <>{fallback}</>;
}

// Verse text rendered word-by-word with the real per-word QCF4 glyphs — the
// same precomposed Mushaf font used in 'both' mode — instead of a generic
// Uthmani webfont. Falls back to the plain Uthmani text while the page's
// QCF4 data/fonts are loading, or if the verse can't be found there.
function QcfVerseText({ page, chapterId, verseNumber, fallback }: { page: number; chapterId: number; verseNumber: number; fallback: string }) {
  const [words, setWords] = useState<MushafWord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWords(null);
    (getCachedPage(page) ? Promise.resolve(getCachedPage(page)!) : fetchAndCachePage(page)).then(data => {
      if (cancelled || !data) return;
      const found: MushafWord[] = [];
      for (const line of data.lines) {
        for (const w of line.words) {
          if ((w.type === 'word' || w.type === 'end') && w.surah === chapterId && w.verse === verseNumber) found.push(w);
        }
      }
      if (!found.length) return; // verse not on this page (boundary edge case) — keep fallback
      const fonts = Array.from(new Set(found.map(w => w.font)));
      Promise.all(fonts.map(loadQcfFont)).then(() => { if (!cancelled) setWords(found); });
    });
    return () => { cancelled = true; };
  }, [page, chapterId, verseNumber]);

  if (!words) return <>{fallback}</>;

  // flexDirection:'row' + direction:'rtl' (not plain bidi text flow) — the
  // QCF4 glyphs are PUA codepoints with no defined Unicode bidi class, so
  // the browser's bidi algorithm doesn't reliably reorder them right-to-left
  // on its own; flexbox's axis reversal doesn't depend on that at all. Same
  // technique LineRow uses for the same reason in MushafQCFPage.
  return (
    <span dir="rtl" style={{ display: 'inline-flex', flexDirection: 'row', flexWrap: 'wrap', direction: 'rtl', justifyContent: 'center' }}>
      {words.map((w, i) => (
        <span key={i} style={{
          fontFamily: `"${w.font}"`,
          fontSize: w.type === 'end' ? '0.72em' : undefined,
          color: w.type === 'end' ? '#c9a24b' : undefined,
        }} translate="no">
          {w.char}
        </span>
      ))}
    </span>
  );
}

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
  const [repeatVerse, setRepeatVerse] = useState(false);

  // New UI state
  const [reciterId, setReciterId] = useState('ar.alafasy');
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [surahFilter, setSurahFilter] = useState('');
  const [searchSurah, setSearchSurah] = useState(initialSurah);
  const [searchAyah, setSearchAyah] = useState(1);
  const [tappedVerse, setTappedVerse] = useState<TappedVerse | null>(null);

  // Header/footer chrome — hidden by default in Mushaf ('both') mode,
  // toggled only by a tap on the page background (toggleChrome/onPageTap).
  const [headerHidden, setHeaderHidden] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);

  // Swipe-to-turn-page refs (Arabic RTL: swipe left = next, swipe right = prev)
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);

  // Refs for closure-safe access in audio callbacks
  const versesRef   = useRef<QuranVerse[]>([]);
  const currentRef  = useRef(0);
  const playingRef  = useRef(false);
  const repeatRef   = useRef(false);
  const pageRef     = useRef(initialPage);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verseRefs   = useRef<(HTMLSpanElement | null)[]>([]);
  const isMountedRef = useRef(true);
  // Set right before navigating to a page so the page's own verse-fetch
  // effect can land on a specific verse instead of defaulting to index 0 —
  // needed because a page can open mid-surah (the previous surah's tail
  // verses share the page, common in juz 30's short surahs), so "index 0 of
  // this page" is not always "ayah 1 of the surah the user picked".
  const targetVerseRef = useRef<{ chapter: number; verse: number } | null>(null);

  // Read mode from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem('khatmati-mode') as Mode;
    // 'read' tab removed — fall back to listen
    if (stored === 'listen' || stored === 'both') setMode(stored);
  }, []);

  // Mushaf reading ('both' mode) is immersive by default — chrome revealed
  // only via a tap on the page background (toggleChrome/onPageTap). This
  // used to also run a scroll-direction auto-hide left over from a removed
  // vertical verse-list view ('read' mode, see the comment below) — the
  // Mushaf carousel never produces real window scroll, so that listener was
  // dead weight that could still fire from iOS overscroll bounce and stomp
  // on the deliberate tap toggle. Single source of truth now: this effect
  // sets the immersive default on mode entry, and toggleChrome/goVerse are
  // the only other writers.
  useEffect(() => {
    setHeaderHidden(mode === 'both');
  }, [mode]);

  // Sync state → refs so audio callbacks always read current values
  useEffect(() => { versesRef.current = verses; }, [verses]);
  useEffect(() => { currentRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { repeatRef.current = repeatVerse; }, [repeatVerse]);
  useEffect(() => { pageRef.current = page; }, [page]);

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
          const target = targetVerseRef.current;
          targetVerseRef.current = null;
          const idx = target ? v.findIndex(x => x.chapter_id === target.chapter && x.verse_number === target.verse) : -1;
          const start = idx >= 0 ? idx : 0;
          currentRef.current = start;
          setCurrentIdx(start);
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
      if (repeatRef.current) { playFromRef(); return; }
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

  // revealChrome defaults to true for explicit navigation (search, prev/next
  // buttons) — false for a Mushaf word tap, which only syncs the audio
  // cursor and must not fight the page's own tap-to-toggle chrome gesture.
  function goVerse(idx: number, revealChrome = true) {
    if (idx < 0 || idx >= verses.length) return;
    currentRef.current = idx;
    setCurrentIdx(idx);
    setAutoFollow(true); // resume auto-follow on explicit navigation
    if (revealChrome) setHeaderHidden(false);
    if (isPlaying) playFromRef();
  }

  // "استماع" from the long-press action menu — jump to this verse and start
  // playback unconditionally (unlike goVerse, which only resumes playback if
  // already playing).
  function listenToVerse(chapterId: number, verseNumber: number) {
    const idx = versesRef.current.findIndex(x => x.chapter_id === chapterId && x.verse_number === verseNumber);
    if (idx < 0) return;
    currentRef.current = idx;
    setCurrentIdx(idx);
    setAutoFollow(true);
    setHeaderHidden(false);
    playingRef.current = true;
    setIsPlaying(true);
    playFromRef();
  }

  // Fires on every manual page change — swipe is now the only way to turn
  // pages, so this (previously only wired to the prev/next buttons) has to
  // live on the swipe callback: stop playback and count the page toward
  // today's wird, same as the buttons used to.
  function handlePageChange(next: number) {
    if (next === page) return;
    audioRef.current?.pause();
    setIsPlaying(false);
    playingRef.current = false;
    pageRef.current = next;
    setPage(next);
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

  // A light tap on the Mushaf page (not a long-press on a word) reveals or
  // re-hides the header/footer chrome — the page itself stays full-bleed.
  function toggleChrome() {
    setHeaderHidden(h => !h);
  }

  function changeMode(m: Mode) {
    setMode(m);
    localStorage.setItem('khatmati-mode', m);
  }

  // ── Current verse info ────────────────────────────────────────────────────

  const cv = verses[currentIdx];
  const surahNameAr = SURAH_NAMES_AR[(cv?.chapter_id ?? 1) - 1] ?? '';
  const surahNameEn = SURAH_NAMES_EN[(cv?.chapter_id ?? 1) - 1] ?? '';

  const qFont = "'Amiri Quran', 'Scheherazade New', 'Traditional Arabic', serif";


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen" style={{ background: mode === 'listen' ? '#05101f' : '#F8EBD5', overflow: mode === 'listen' ? 'hidden' : undefined }}>

      {/* ── Top bar ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex flex-col gap-0"
        style={{ transform: (mode === 'both' && headerHidden) ? 'translateY(-100%)' : 'translateY(0)', transition: 'transform 0.25s ease' }}>
        {/* Row 1: surah list (right) | page nav | search | back arrow (left) */}
        <div className="flex items-center gap-2 px-3 py-2" dir="rtl"
          style={{ background: mode === 'both' ? 'rgba(247,242,232,0.55)' : 'var(--tr-header-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: mode === 'both' ? '1px solid rgba(171,136,68,0.2)' : '1px solid var(--tr-border-subtle)' }}>

          {/* Surah list button — rightmost in RTL */}
          <button onClick={() => setShowSearch(true)}
            className="flex items-center gap-1 h-8 px-2 rounded-full shrink-0 transition active:scale-90"
            style={{ background: mode === 'both' ? 'rgba(171,136,68,0.1)' : 'var(--tr-overlay)', color: mode === 'both' ? '#5a3e10' : 'var(--tr-text-secondary)', maxWidth: 120 }}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 6h16M4 12h10M4 18h7"/>
            </svg>
            <span className="text-[11px] font-bold truncate" style={{ fontFamily: qFont }}>
              {cv ? (isRtl ? surahNameAr : surahNameEn) : (isRtl ? 'السور' : 'Surahs')}
            </span>
          </button>

          {/* Page + surah info (center) — no nav buttons, page turning is swipe-only.
              The right/left-page indicator lives on the Mushaf page itself
              (MushafTopMetadata), not in this floating app header. */}
          <div className="flex-1 text-center">
            <p className="text-xs font-black leading-none" style={{ color: mode === 'both' ? '#2e1a00' : 'var(--tr-text-primary)' }}>
              {isRtl ? `صفحة ${toArabicNum(page)}` : `Page ${page}`}
            </p>
            {cv && <p className="text-[10px] mt-0.5 leading-none" style={{ color: mode === 'both' ? '#7a5a30' : 'var(--tr-text-muted)' }}>{isRtl ? surahNameAr : surahNameEn}</p>}
          </div>

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
        <div className="flex" style={{ background: mode === 'both' ? 'rgba(240,232,210,0.5)' : 'var(--tr-surface)', backdropFilter: mode === 'both' ? 'blur(20px)' : undefined, WebkitBackdropFilter: mode === 'both' ? 'blur(20px)' : undefined, borderBottom: mode === 'both' ? '1px solid rgba(171,136,68,0.2)' : '1px solid var(--tr-border-subtle)' }}>
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

      {/* ── Content area ── */}
      <div className="flex-1"
        style={{
          position: 'relative',
          /*
           * In Mushaf mode, the page uses the FULL screen while the chrome is
           * hidden (true immersive reading — no reserved gap at the top) and
           * only makes room for the header/audio-player once a tap reveals
           * them. 'listen' mode's chrome is always visible, so it keeps the
           * constant reservation.
           */
          paddingTop: mode === 'both' && headerHidden ? 0 : 88,
          paddingBottom: mode === 'both' ? (headerHidden ? 0 : 'calc(83px + env(safe-area-inset-bottom, 0px))') : 0,
          transition: 'padding 0.25s ease',
          ...(mode === 'both' ? { display: 'flex', flexDirection: 'column' } : {}),
        }}>

        {/*
         * 'both' mode — Mushaf carousel is ALWAYS rendered, independent of verse-fetch
         * loading state. The carousel fetches its own page JSON. The global `loading`
         * state only gates audio playback (verse data), not the visual Mushaf.
         */}
        {mode === 'both' && (
          <MushafCarousel
            page={page}
            currentChapter={cv?.chapter_id ?? initialSurah}
            currentVerse={cv?.verse_number ?? initialAyah}
            autoFollow={autoFollow}
            isPlaying={isPlaying}
            onPageChange={handlePageChange}
            onVerseClick={(ch, v) => {
              const idx = versesRef.current.findIndex(x => x.chapter_id === ch && x.verse_number === v);
              if (idx >= 0) goVerse(idx, false);
            }}
            onAyahTap={setTappedVerse}
            onPageTap={toggleChrome}
          />
        )}

        {/* Dims the page whenever the header/footer chrome is showing — the
            visual cue that you're outside pure reading mode. Purely visual:
            pointerEvents:none lets the tap that hides the chrome again reach
            the Mushaf page underneath. */}
        {mode === 'both' && !headerHidden && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none', transition: 'opacity 0.25s ease', zIndex: 5 }} />
        )}

        {/* Listen mode — loading / error / content */}
        {mode === 'listen' && (loading ? (
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
            {cv && (
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

                  {/* Reciter chip + repeat-ayah toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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

                    <button onClick={() => setRepeatVerse(r => !r)} title={isRtl ? 'تكرار الآية' : 'Repeat ayah'} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                      background: repeatVerse ? 'linear-gradient(135deg, #60a5fa, #2563eb)' : 'rgba(255,255,255,0.08)',
                      border: repeatVerse ? '1px solid rgba(147,197,253,0.6)' : '1px solid rgba(255,255,255,0.15)',
                      boxShadow: repeatVerse ? '0 2px 10px rgba(37,99,235,0.45)' : 'none',
                      transition: 'background .2s, box-shadow .2s',
                    }}>
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={repeatVerse ? '#fff' : 'rgba(255,255,255,0.6)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 2.1l4 4-4 4"/>
                        <path d="M3 12.1v-2a4 4 0 0 1 4-4h14"/>
                        <path d="M7 21.9l-4-4 4-4"/>
                        <path d="M21 11.9v2a4 4 0 0 1-4 4H3"/>
                      </svg>
                    </button>
                  </div>

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
                      <QcfVerseText page={page} chapterId={cv.chapter_id} verseNumber={cv.verse_number} fallback={cv.text_uthmani} />
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

          </>
        ))}
      </div>

      {/* ── Audio player (fixed bottom — both mode only) ── */}
      {mode === 'both' && (
        <div className="fixed bottom-0 left-0 right-0 z-40"
          style={{
            background: 'rgba(240,232,210,0.55)', borderTop: '1px solid rgba(171,136,68,0.3)', boxShadow: '0 -4px 24px rgba(90,62,16,0.12)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            // Shares headerHidden with the top bar — a light tap on the Mushaf
            // page's background (see onPageTap) shows/hides both together.
            transform: headerHidden ? 'translateY(100%)' : 'translateY(0)', transition: 'transform 0.25s ease',
          }}>

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
                          // Some pages open mid-surah (the previous surah's
                          // tail verses share the page) — target ayah 1 of
                          // the picked surah explicitly, not "index 0".
                          targetVerseRef.current = { chapter: num, verse: 1 };
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
                          <SurahHeaderName surahNum={num} fallback={ar} />
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
        <VerseActionSheet
          verse={tappedVerse}
          onClose={() => setTappedVerse(null)}
          onListen={() => listenToVerse(tappedVerse.chapterId, tappedVerse.verseNumber)}
        />
      )}
    </div>
  );
}
