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
    ? 'linear-gradient(90deg, rgba(92,68,38,0.15) 0%, rgba(140,108,66,0.055) 7%, rgba(255,252,241,0.17) 18%, rgba(255,255,255,0) 45%, rgba(255,250,232,0.15) 100%)'
    : 'linear-gradient(270deg, rgba(92,68,38,0.15) 0%, rgba(140,108,66,0.055) 7%, rgba(255,252,241,0.17) 18%, rgba(255,255,255,0) 45%, rgba(255,250,232,0.15) 100%)';
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
// RELEASE (pointerdown timestamp vs. pointerup time), not by racing a
// setTimeout against a cancel-on-release handler — touch event timing on
// mobile is inconsistent enough that the timer-race version was firing the
// long-press action on ordinary short taps.
const LONG_PRESS_MS = 500;

// A genuine tap/long-press must stay roughly still — real fingers always
// drift a few px, but this rules out the case that was silently breaking
// word taps on real devices: the browser's OWN native touch-to-click
// synthesis suppresses `click` entirely once total finger movement crosses
// a hidden internal threshold (measured on real Chromium: click still fires
// at ~15px of drift, is gone by ~20px) — completely independent of any
// preventDefault this app calls. A single glyph is a much smaller, more
// fiddly target than the open page background, so real users correct their
// finger position mid-tap far more often when aiming at one word among many
// tightly-packed ones — easily crossing that threshold — while a synthetic
// zero-movement Playwright click can never reproduce it. Deciding tap-vs-
// drag ourselves from pointerdown/pointerup coordinates (instead of trusting
// the browser's opaque, movement-dependent `click` firing) fixes this for
// any amount of real-world drift up to the threshold below, and safely bows
// out (does nothing, lets the carousel's own drag/swipe logic own the
// gesture) past it.
const TAP_MOVE_THRESHOLD_PX = 12;

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
  // Fitting a line to the available width now adjusts the GAP between
  // words, not a uniform transform — a transform squeezes/stretches every
  // glyph's own shape (visibly distorted letters, and it stretches the
  // gaps between words too, which read as "extra" empty space on lines
  // that only needed a little help reaching the edge). Shrinking or growing
  // only the space BETWEEN words leaves every glyph exactly its natural,
  // undistorted shape. CSS `gap` can't go negative, though — for the rare
  // line still too wide at gap:0 (all words already touching), a small
  // residual scaleX is the fallback, kept separate from the two-element
  // clip/transform split below so it stays safe when it's actually needed.
  const outerRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<{ justify: 'center' | 'flex-start'; gap: number; scaleX: number }>({ justify: 'center', gap: 0, scaleX: 1 });

  // One shared ref (not a per-word closure variable) so the press start info
  // survives a re-render between pointerdown and pointerup — LineRow can
  // legitimately re-render mid-press (e.g. the playing verse's highlight
  // changing while a finger is still down), which would otherwise hand
  // pointerup a brand-new closure with its start values reset to nothing.
  const pressRef = useRef<{ pointerId: number; startAt: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const row = rowRef.current;
    if (!outer || !row) return;
    const measure = () => {
      const available = outer.clientWidth;
      // Measure at gap:0 first — this is each word's own natural width
      // (including its own padding) with zero artificial space between
      // them, i.e. the tightest the line can possibly get without scaling.
      row.style.gap = '0px';
      const minWidth = row.scrollWidth;
      const gapCount = words.length - 1;
      if (!compact && minWidth / available >= FULL_LINE_THRESHOLD) {
        if (gapCount > 0 && minWidth <= available) {
          // Normal case: distribute the remaining room evenly between
          // words (or compress it out of existing padding-driven gaps)
          // so the line reaches the edge with no distortion at all.
          setLayout({ justify: 'flex-start', gap: (available - minWidth) / gapCount, scaleX: 1 });
        } else {
          // Even fully tight, this line's own glyphs exceed the width —
          // extremely rare; fall back to a minimal, last-resort scale.
          setLayout({ justify: 'flex-start', gap: 0, scaleX: minWidth > available ? available / minWidth : 1 });
        }
      } else {
        // Short/compact line — natural tight spacing, no stretching.
        setLayout({ justify: 'center', gap: 0, scaleX: minWidth > available ? available / minWidth : 1 });
      }
    };
    measure();
    // A font can finish loading (per loadQcfFont's promise) fractionally
    // before the browser has actually reflowed elements against it — cheap
    // safety net, re-measure once document.fonts.ready confirms it's settled.
    document.fonts.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [words, compact]);

  return (
    <div
      ref={outerRef}
      dir="rtl"
      style={{
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
        direction: 'rtl',
        display: 'flex',
        // Positions the (max-content-width) row as a whole within the full
        // available width — a single flex item has nothing for its OWN
        // justify-content to distribute, so this has to live one level up.
        justifyContent: layout.justify === 'center' ? 'center' : 'flex-start',
      }}
    >
    <div
      ref={rowRef}
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'baseline',
        direction: 'rtl',
        fontSize,
        // Tighter than a generic reading line-height on purpose — with 15
        // fixed line-slots per page and a hard page-height cap (see the root
        // element in MushafQCFPage), less vertical space per line means the
        // vh-aware fontSize clamp below can pick a bigger size (closer to
        // its width cap) while the whole page still fits without clipping.
        lineHeight: 1.85,
        width: 'max-content',
        gap: layout.gap > 0 ? `${layout.gap}px` : undefined,
        // Only the rare fallback case (see the measure() comment above)
        // ever sets a scaleX other than 1 — the normal fit is via gap.
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

        return (
          <span
            key={wi}
            ref={checkAttachRef(isHl)}
            onPointerDown={clickable ? (e) => {
              pressRef.current = { pointerId: e.pointerId, startAt: Date.now(), x: e.clientX, y: e.clientY };
            } : undefined}
            // Deciding the tap here — from pointerdown/pointerup coordinates
            // and elapsed time — rather than trusting the browser's native
            // `click` event. `click` firing at all is gated by the browser's
            // OWN opaque, movement-dependent tap-vs-drag heuristic: verified
            // on real Chromium that `click` still fires after ~15px of finger
            // drift but is silently gone by ~20px, regardless of anything
            // this app does. A single glyph is a far fiddlier target than the
            // open page background, so real fingers correct position mid-tap
            // — and drift past that threshold — far more often when aiming at
            // one word among many tightly-packed ones. That made word taps
            // fail intermittently on real touchscreens while a zero-movement
            // synthetic click (or an easy, generous background tap) never
            // showed it. Measuring the actual distance ourselves and only
            // ever treating it as a genuine tap under TAP_MOVE_THRESHOLD_PX
            // removes the browser's guesswork entirely; past the threshold we
            // do nothing and let the carousel's own drag/swipe logic own the
            // gesture, same as before.
            onPointerUp={clickable ? (e) => {
              const press = pressRef.current;
              pressRef.current = null;
              if (!press || press.pointerId !== e.pointerId) return;
              const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
              if (dist > TAP_MOVE_THRESHOLD_PX) return;
              e.preventDefault();
              e.stopPropagation();
              const held = Date.now() - press.startAt;
              if (held >= LONG_PRESS_MS) {
                const verseText = verseTextMap.get(`${word.surah}:${word.verse}`) ?? word.text;
                onAyahTap?.({ chapterId: word.surah, verseNumber: word.verse, text: verseText });
              } else {
                // A short tap — on a word or on empty page background — does
                // ONE thing only: toggle the header/footer chrome. It used to
                // also jump the audio cursor to the tapped word (onVerseClick),
                // which fought the chrome-toggle gesture by also restarting
                // playback / moving the highlight — a tap should never have
                // two different effects at once.
                onPageTap?.();
              }
            } : undefined}
            onPointerCancel={clickable ? () => { pressRef.current = null; } : undefined}
            // Some browsers still synthesize a `click` after a handled
            // pointerup regardless of preventDefault there — swallow it here
            // (stopPropagation only, no logic) so it can never also bubble to
            // the page's root onClick and double-toggle the chrome. All real
            // tap/long-press handling already happened above, on pointerup.
            onClick={clickable ? (e) => e.stopPropagation() : undefined}
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
              padding: clickable ? '3px 2px' : undefined,
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
  // (only real word glyphs — 'end'/'surah_header'/'bismillah' carry placeholder text).
  // A handful of sajda (prostration) ornament entries in the source data are
  // mistagged type:'word' with a placeholder reference string for `text`
  // (e.g. "#1969" at 19:58) instead of real Arabic — their glyph still
  // renders correctly (that comes from `char`), but that placeholder must
  // not leak into any text built from `text` (tafsir header, share card,
  // search index). Filtered by requiring at least one Arabic letter.
  const verseTextMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    if (!data) return map;
    for (const line of data.lines) {
      for (const w of line.words) {
        if (w.type !== 'word' || !/[؀-ۿ]/.test(w.text)) continue;
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

      {/* Page body — regular (15-line) pages use space-evenly so every line
          slot lands on the printed Mushaf's grid. Compact pages (opening 1-2,
          juz 30's short surahs) genuinely have fewer lines — space-evenly
          would stretch them out to reach the bottom of the page with large
          gaps, which isn't how those pages actually look; they use the
          standard top-down flow instead, sized to their own content. */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: compact ? 'flex-start' : 'space-evenly',
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
    // vh coefficients: verified against a realistic body budget (viewport
    // minus the top-metadata/footer chrome, ~78px combined) that 13 full
    // text lines at this size stay well within the remaining space even
    // before the LineRow-level width fit does its own (now fixed — see
    // LineRow's comment) horizontal scale-to-fit.
    const fontSize = opening ? 'clamp(18px, 3.2vh, 26px)' : 'clamp(16px, min(6.3vw, 3vh), 30px)';

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
