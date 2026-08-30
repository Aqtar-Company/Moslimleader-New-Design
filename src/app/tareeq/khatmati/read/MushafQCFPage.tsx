'use client';
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { getCachedPage, fetchAndCachePage, prepareMushafPage, getPageJuz, getPageHizb } from './mushafCache';
import type { PageData, MushafLine, MushafWord } from './mushafCache';
import { loadQcfFont, QBSML_FONT } from './qcfFonts';

// Font for page chrome only (juz/hizb/page-number labels) — NOT Quran body text,
// which is rendered with the real QCF4 per-word glyphs (see loadQcfFont).
const UI_FONT = "'Amiri Quran','Scheherazade New','Traditional Arabic',serif";

const JUZ_AR = ['','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون','الحادي والعشرون','الثاني والعشرون','الثالث والعشرون','الرابع والعشرون','الخامس والعشرون','السادس والعشرون','السابع والعشرون','الثامن والعشرون','التاسع والعشرون','الثلاثون'];

function isOpeningPage(page: number) { return page === 1 || page === 2; }
function juzLabel(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `جزء ${n}`; }

// Very subtle paper-curvature shading — kept purely decorative (low opacity,
// no hard edges) so it never competes with the text. The shadow always leans
// toward the Mushaf's spine: right pages (odd) have the spine on their left,
// left pages (even) have it on their right.
function paperGradient(isRightPage: boolean): string {
  return isRightPage
    ? 'linear-gradient(90deg, rgba(92,68,38,0.10) 0%, rgba(140,108,66,0.035) 7%, rgba(255,252,241,0.12) 18%, rgba(255,255,255,0) 45%, rgba(255,250,232,0.10) 100%)'
    : 'linear-gradient(270deg, rgba(92,68,38,0.10) 0%, rgba(140,108,66,0.035) 7%, rgba(255,252,241,0.12) 18%, rgba(255,255,255,0) 45%, rgba(255,250,232,0.10) 100%)';
}

// ── Surah header — real QCF4_QBSML glyph (the exact Mushaf calligraphy) over
//    the existing decorative frame artwork ────────────────────────────────
function SurahHeader({ word, nameArabic }: { word: MushafWord; nameArabic: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadQcfFont(QBSML_FONT).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    // Frame narrowed to 82% (was 100%) and centered — since it keeps its own
    // aspect ratio, a narrower frame is also a SHORTER one, freeing vertical
    // space for the body's 15 line-slots on the page's now-fixed height.
    <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/surah_header_mushaf.svg" alt="" aria-hidden="true" draggable={false}
        style={{ width: '82%', height: 'auto', display: 'block', userSelect: 'none' }}
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {ready ? (
          <span style={{ fontFamily: `"${word.font}"`, fontSize: 26, color: '#0a0500', lineHeight: 1 }} translate="no">
            {word.char}
          </span>
        ) : (
          <span style={{ fontFamily: UI_FONT, fontSize: 16, fontWeight: 700, color: '#0a0500', lineHeight: 1 }}>
            {nameArabic}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Bismillah — real QCF4 glyph in the page's own font (same glyph the rest
//    of the page uses, so it never looks like a mismatched insert) ─────────
function BismillahLine({ word }: { word: MushafWord }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
      <span style={{ fontFamily: `"${word.font}"`, fontSize: 24, color: '#0a0500', lineHeight: 1.5 }} translate="no">
        {word.char}
      </span>
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────
// Passive right/left-page indicator — odd pages sit on the right of a Mushaf
// spread, even pages on the left. Lives on the page itself (not the app's
// floating header), between the juz and surah labels.
function PageSideIcon({ page }: { page: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={page % 2 === 1 ? '/Flin%20Pages%20Icom.png' : '/Flip%20Pages%20Icon%20-%20Left.png'}
      alt="" aria-hidden="true" draggable={false}
      style={{ width: 18, height: 18, display: 'block', flexShrink: 0 }}
    />
  );
}

function MushafTopMetadata({ juz, surahLabel, page }: { juz: number; surahLabel: string; page: number }) {
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px 8px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0a0500', fontFamily: UI_FONT, lineHeight: 1.4 }}>
        {juz ? juzLabel(juz) : ''}
      </span>
      <PageSideIcon page={page} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0a0500', fontFamily: UI_FONT, lineHeight: 1.4 }}>
        {surahLabel}
      </span>
    </div>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────
// Page-number ornament already carries its own flourishes on both sides,
// so it stands alone — no separate rosette bookends needed.
function PageNumberBadge({ page }: { page: number }) {
  return (
    <div style={{ position: 'relative', width: 104, height: 26, flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/quran-page-num-box.png" alt="" aria-hidden="true" draggable={false}
        style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none' }}
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Amiri Quran's digit glyphs sit low in their own em-box (measured ~3px
            low at this size) — nudge up so the number reads as centered in the box. */}
        <span style={{ fontSize: 12, fontWeight: 700, color: '#4a3a1a', fontFamily: UI_FONT, lineHeight: 1, transform: 'translateY(-3px)' }}>{page}</span>
      </div>
    </div>
  );
}

function MushafFooter({ hizb, page }: { hizb: number; page: number }) {
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px 10px', flexShrink: 0, maxWidth: 520, margin: '0 auto', width: '100%' }}>
      <span style={{ fontSize: 12, color: '#0a0500', fontFamily: UI_FONT, fontWeight: 500, minWidth: 60 }}>
        {hizb ? `الحزب ${hizb}` : ''}
      </span>
      <PageNumberBadge page={page} />
      <span style={{ minWidth: 60 }} />
    </div>
  );
}

// ── Text line — natural spacing + scale-to-fit ─────────────────────────────
// QCF4 words are precomposed glyphs with their own inter-word spacing baked
// in by the type designer for that exact line — CSS justify-content:
// space-between/space-around impose ADDITIONAL equal gaps on top of that,
// which both overflows dense lines (clipped on the left — RTL's overflow
// side) and, even on lines that fit, produces a visibly ragged left margin,
// since the artificial equal gaps don't match the font's own uneven,
// word-specific spacing. Removing the imposed gaps and instead measuring the
// line's natural (already-correctly-spaced) width against the available
// width, then scaling the whole line by that ratio, reproduces the printed
// Mushaf's edge-to-edge look without fighting the font: verified this lands
// every line's visible ink within ~1px of the true margin, vs. up to 40px of
// variance with space-between, across all 604 pages.
// A short line (natural width well under the container) is a genuine short
// line — the last line of a passage, or anything on a compact/opening/juz-30
// page — and stays centered at its natural size instead of being stretched
// into a distorted, oversized line just to reach both edges.
const FULL_LINE_THRESHOLD = 0.6;

// Long-press (not a short tap) on an ayah opens its action menu (استماع /
// تفسير / مشاركة) — a short tap just syncs the audio cursor to that verse
// and also counts as a "light tap" toggling the page's hidden header/footer
// chrome, same as tapping the page's background. Decided by elapsed time AT
// RELEASE (pointerdown timestamp vs. click time), not by racing a setTimeout
// against a cancel-on-release handler — touch event timing on mobile is
// inconsistent enough that the timer-race version was firing the long-press
// action on ordinary short taps.
const LONG_PRESS_MS = 500;

function LineRow({
  words, compact, fontSize, isPlaying, currentChapter, currentVerse,
  verseTextMap, onAyahTap, onVerseClick, onPageTap, checkAttachRef,
}: {
  words: MushafWord[];
  compact: boolean;
  fontSize: number | string;
  isPlaying?: boolean;
  currentChapter: number;
  currentVerse: number;
  verseTextMap: Map<string, string>;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  onVerseClick?: (chapter: number, verse: number) => void;
  onPageTap?: () => void;
  checkAttachRef: (isHl: boolean) => React.RefObject<HTMLSpanElement> | undefined;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<{ justify: 'center' | 'flex-start'; scaleX: number }>({ justify: 'center', scaleX: 1 });

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    const measure = () => {
      el.style.transform = 'none';
      const available = el.clientWidth;
      // scrollWidth on a width:100% flex row can't report LESS than the row's
      // own box — a short (underfilling) flex-start line just leaves the
      // leftover space empty, and scrollWidth still reports the full 100%,
      // indistinguishable from a line that genuinely fills it. Measure the
      // true natural width by letting the row size to its content instead.
      // Unobserve first: this resize is our own doing, not a real layout
      // change, and re-triggering off it would loop.
      ro?.unobserve(el);
      el.style.width = 'max-content';
      const naturalWidth = el.scrollWidth;
      el.style.width = '100%';
      ro?.observe(el);
      if (!compact && naturalWidth / available >= FULL_LINE_THRESHOLD) {
        setLayout({ justify: 'flex-start', scaleX: available / naturalWidth });
      } else {
        setLayout({ justify: 'center', scaleX: naturalWidth > available ? available / naturalWidth : 1 });
      }
    };
    measure();
    // A font can finish loading (per loadQcfFont's promise) fractionally
    // before the browser has actually reflowed elements against it — cheap
    // safety net, re-measure once document.fonts.ready confirms it's settled.
    document.fonts.ready.then(measure);
    ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro?.disconnect();
  }, [words, compact]);

  return (
    <div
      ref={rowRef}
      dir="rtl"
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: layout.justify,
        alignItems: 'baseline',
        direction: 'rtl',
        fontSize,
        // Tighter than a generic reading line-height on purpose — with 15
        // fixed line-slots per page and a hard page-height cap (see the root
        // element in MushafQCFPage), less vertical space per line means the
        // vh-aware fontSize clamp below can pick a bigger size (closer to
        // its width cap) while the whole page still fits without clipping.
        lineHeight: 1.85,
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
        transform: layout.scaleX !== 1 ? `scaleX(${layout.scaleX})` : undefined,
        // A full (flex-start) line is anchored at the right — RTL's start
        // edge — so scaling never shifts where the line begins, only how far
        // it reaches. A centered short line scales from its own center.
        transformOrigin: layout.justify === 'center' ? 'center' : 'right center',
      }}
    >
      {words.map((word, wi) => {
        const clickable = word.type === 'word' || word.type === 'end';
        const isHl = isPlaying === true && clickable
          && word.surah === currentChapter && word.verse === currentVerse;

        // Plain closure per word span — recreated each render, no hooks-in-a-loop issue.
        let pressStartAt = 0;

        return (
          <span
            key={wi}
            ref={checkAttachRef(isHl)}
            onPointerDown={clickable ? () => { pressStartAt = Date.now(); } : undefined}
            // Deliberately a click handler, not pointerup: native click is
            // suppressed by the browser after a drag (a page-turn swipe), so
            // this only ever fires for a genuine stationary tap/long-press —
            // pointerup alone would also fire at the end of every swipe.
            // Long vs. short is decided here, from real elapsed time, rather
            // than by a setTimeout racing a cancel-on-release handler.
            onClick={clickable ? (e) => {
              e.stopPropagation();
              const held = Date.now() - pressStartAt;
              if (held >= LONG_PRESS_MS) {
                const verseText = verseTextMap.get(`${word.surah}:${word.verse}`) ?? word.text;
                onAyahTap?.({ chapterId: word.surah, verseNumber: word.verse, text: verseText });
              } else {
                onVerseClick?.(word.surah, word.verse);
                onPageTap?.();
              }
            } : undefined}
            onContextMenu={clickable ? (e) => e.preventDefault() : undefined}
            style={{
              display: 'inline',
              whiteSpace: 'nowrap',
              fontFamily: `"${word.font}"`,
              fontSize: word.type === 'end' ? '0.72em' : undefined,
              color: word.type === 'end' ? '#7a5200' : '#010101',
              // Padding/radius are constant regardless of isHl — only the
              // background color toggles. Making them conditional on isHl
              // (as before) changed the word's own box size the instant it
              // got highlighted, reading as the word "growing".
              background: isHl ? 'rgba(190,160,80,0.32)' : 'transparent',
              borderRadius: clickable ? 6 : 0,
              padding: clickable ? '4px 3px' : undefined,
              cursor: clickable ? 'pointer' : 'default',
              transition: 'background .15s',
              WebkitTouchCallout: 'none',
              flexShrink: 0,
            }}
          >
            {word.char}
          </span>
        );
      })}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────
interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  isPlaying?: boolean;
  onVerseClick?: (chapter: number, verse: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  onPageTap?: () => void;
  autoFollow?: boolean;
}

// ── Main component ───────────────────────────────────────────────────────
export default function MushafQCFPage({
  page, currentChapter, currentVerse, isPlaying,
  onVerseClick, onAyahTap, onPageTap, autoFollow,
}: Props) {
  const opening = isOpeningPage(page);
  // "قصار السور" (juz 30, An-Naba → An-Nas) has naturally short ayahs — edge-to-edge
  // CSS word-spacing looks stretched/unnatural there, same as on the opening pages.
  const compact = opening || getPageJuz(page) === 30;
  // Odd pages sit on the right of a Mushaf spread, even pages on the left —
  // same convention used for the passive page-side indicator in the reader header.
  const pageBackground = { backgroundColor: '#F8EBD5', backgroundImage: paperGradient(page % 2 === 1) };

  const [localData, setLocalData] = useState<PageData | null>(null);
  // Only use localData if it belongs to the current page — never show a previous page's content
  const data: PageData | null = getCachedPage(page) ?? (localData?.page === page ? localData : null);

  const [fontsReady, setFontsReady] = useState(false);

  const hlRef = useRef<HTMLSpanElement | null>(null);
  let hlRefAttached = false;

  // Fetch page data
  useEffect(() => {
    setLocalData(null);
    if (getCachedPage(page)) return;
    let cancelled = false;
    fetchAndCachePage(page).then(d => { if (!cancelled && d) setLocalData(d); });
    return () => { cancelled = true; };
  }, [page]);

  // Pre-warm adjacent pages
  useEffect(() => {
    prepareMushafPage(page - 2);
    prepareMushafPage(page - 1);
    prepareMushafPage(page + 1);
    prepareMushafPage(page + 2);
  }, [page]);

  // Load the QCF4 fonts this page needs before rendering any glyphs — avoids
  // a flash of tofu/boxes from an unloaded font. Re-runs only when the page's
  // font actually changes (adjacent pages usually share the same font file).
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setFontsReady(false);
    // Bismillah glyphs always use QCF4_Hafs_01 regardless of the page's own
    // font (verified across pages 1, 2, 300, 577, 604), so it must always be
    // loaded alongside the page's main font — not just when they coincide.
    Promise.all([loadQcfFont(data.font), loadQcfFont(QBSML_FONT), loadQcfFont('QCF4_Hafs_01')]).then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => { cancelled = true; };
  }, [data?.font]);

  // Auto-scroll highlighted verse
  useEffect(() => {
    if (autoFollow && hlRef.current) {
      hlRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter, currentVerse, autoFollow]);

  const surahLabel = (data?.surahs ?? []).map(s => s.nameArabic).filter(Boolean).join(' و');
  const juz = getPageJuz(page);
  const hizb = getPageHizb(page);

  // Build a lookup map of full verse text: "surah:verse" → joined Arabic words
  // (only real word glyphs — 'end'/'surah_header'/'bismillah' carry placeholder text)
  const verseTextMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    if (!data) return map;
    for (const line of data.lines) {
      for (const w of line.words) {
        if (w.type !== 'word') continue;
        const key = `${w.surah}:${w.verse}`;
        map.set(key, (map.get(key) ? map.get(key) + ' ' : '') + w.text);
      }
    }
    return map;
  }, [data]);

  if (!data || !fontsReady) {
    return (
      <div style={{ ...pageBackground, height: '100%', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
        <MushafTopMetadata juz={juz} surahLabel={surahLabel} page={page} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`@keyframes ms-spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid rgba(184,152,64,.2)', borderTopColor: '#b89840', animation: 'ms-spin .7s linear infinite' }} />
        </div>
        <MushafFooter hizb={hizb} page={page} />
      </div>
    );
  }

  return (
    <div
      // A tap anywhere on the page that isn't a word (margins, the metadata
      // rows, the footer) reaches here and reveals the hidden header/footer
      // chrome. A click handler (not pointerup) so a page-turn swipe never
      // triggers it — native click is suppressed after a drag. Word spans
      // stopPropagation on their own click so this only fires for genuine
      // "background" taps.
      onClick={() => onPageTap?.()}
      style={{
        ...pageBackground,
        // A fixed height (not minHeight) is load-bearing: it caps the page
        // at exactly the space it's given, so the body's flex:1 + its own
        // overflow:hidden actually constrain content instead of letting the
        // whole page grow taller than the viewport and forcing the carousel
        // slot to scroll — which is what "minHeight" was silently doing.
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}>
      <div style={{ flexShrink: 0 }}>
        <MushafTopMetadata juz={juz} surahLabel={surahLabel} page={page} />
      </div>

      {/* Page body — both opening and regular pages use space-evenly so
          every line slot (text, surah-header, basmala) lands on the grid */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-evenly',
        padding: opening ? '0 8px' : '2px 6px 4px',
        maxWidth: '520px',
        margin: '0 auto',
        width: '100%',
        overflow: 'hidden',
      }}>
        {data.lines.map(line => renderLine(line))}
      </div>

      <div style={{ flexShrink: 0 }}>
        <MushafFooter hizb={hizb} page={page} />
      </div>
    </div>
  );

  function renderLine(line: MushafLine) {
    const first = line.words[0];

    if (first?.type === 'surah_header') {
      const nameArabic = data!.surahs.find(s => s.id === first.surah)?.nameArabic ?? '';
      return (
        <div key={`sh-${line.line}`} style={{ width: '100%' }}>
          <SurahHeader word={first} nameArabic={nameArabic} />
        </div>
      );
    }

    if (first?.type === 'bismillah') {
      return <BismillahLine key={`bm-${line.line}`} word={first} />;
    }

    const words = line.words;
    // Each JSON line = exactly ONE physical Mushaf line. LineRow decides for
    // itself (by measuring) whether this is a full line to stretch edge-to-edge
    // or a short one to center — see its comment for why.
    // Sized against BOTH viewport width and height (min() picks whichever is
    // tighter) — the page has a fixed number of line slots, so on a short or
    // wide viewport a width-only size can be taller than the space actually
    // available, which combined with the page's fixed height (see the root
    // element above) would clip lines instead of fitting them.
    // vh coefficients scaled up to match the tighter 1.85 line-height above
    // (was tuned for 2.1) — same available height now buys a bigger font.
    const fontSize = opening ? 'clamp(18px, 2.9vh, 24px)' : 'clamp(16px, min(5.9vw, 2.6vh), 28px)';

    return (
      <LineRow
        key={line.line}
        words={words}
        compact={compact}
        fontSize={fontSize}
        isPlaying={isPlaying}
        currentChapter={currentChapter}
        currentVerse={currentVerse}
        verseTextMap={verseTextMap}
        onAyahTap={onAyahTap}
        onVerseClick={onVerseClick}
        onPageTap={onPageTap}
        checkAttachRef={(isHl) => {
          if (isHl && !hlRefAttached) { hlRefAttached = true; return hlRef; }
          return undefined;
        }}
      />
    );
  }
}
