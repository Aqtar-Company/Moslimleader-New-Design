'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { getCachedPage, fetchAndCachePage, prepareMushafPage, getPageJuz, getPageHizb } from './mushafCache';
import type { PageData, MushafLine, MushafWord } from './mushafCache';
import { loadQcfFont, QBSML_FONT } from './qcfFonts';

// Font for page chrome only (juz/hizb/page-number labels) — NOT Quran body text,
// which is rendered with the real QCF4 per-word glyphs (see loadQcfFont).
const UI_FONT = "'Amiri Quran','Scheherazade New','Traditional Arabic',serif";

const JUZ_AR = ['','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون','الحادي والعشرون','الثاني والعشرون','الثالث والعشرون','الرابع والعشرون','الخامس والعشرون','السادس والعشرون','السابع والعشرون','الثامن والعشرون','التاسع والعشرون','الثلاثون'];

function isOpeningPage(page: number) { return page === 1 || page === 2; }
function juzLabel(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `جزء ${n}`; }

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
    <div style={{ position: 'relative', width: '100%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/surah_header_mushaf.svg" alt="" aria-hidden="true" draggable={false}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {ready ? (
          <span style={{ fontFamily: `"${word.font}"`, fontSize: 30, color: '#0a0500', lineHeight: 1 }} translate="no">
            {word.char}
          </span>
        ) : (
          <span style={{ fontFamily: UI_FONT, fontSize: 18, fontWeight: 700, color: '#0a0500', lineHeight: 1 }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
      <span style={{ fontFamily: `"${word.font}"`, fontSize: 30, color: '#0a0500', lineHeight: 1.6 }} translate="no">
        {word.char}
      </span>
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────
function MushafBookMark() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M9 1.2 C7.2 1.2 3 2 3 3.4 L3 12 C6 11.1 8 11.5 9 12 L9 1.2 Z" fill="none" stroke="#4a3a1a" strokeWidth="0.8" strokeLinejoin="round"/>
      <path d="M9 1.2 C10.8 1.2 15 2 15 3.4 L15 12 C12 11.1 10 11.5 9 12 L9 1.2 Z" fill="none" stroke="#4a3a1a" strokeWidth="0.8" strokeLinejoin="round"/>
      <line x1="9" y1="1.2" x2="9" y2="12" stroke="#4a3a1a" strokeWidth="0.9"/>
      <line x1="4.5" y1="4.5" x2="7.5" y2="4.5" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      <line x1="4.5" y1="6.2" x2="7.5" y2="6.2" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      <line x1="4.5" y1="7.9" x2="7.5" y2="7.9" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      <line x1="10.5" y1="4.5" x2="13.5" y2="4.5" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      <line x1="10.5" y1="6.2" x2="13.5" y2="6.2" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      <line x1="10.5" y1="7.9" x2="13.5" y2="7.9" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
    </svg>
  );
}

function MushafTopMetadata({ juz, surahLabel }: { juz: number; surahLabel: string }) {
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px 8px' }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0a0500', fontFamily: UI_FONT, lineHeight: 1.4 }}>
        {juz ? juzLabel(juz) : ''}
      </span>
      <MushafBookMark />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0a0500', fontFamily: UI_FONT, lineHeight: 1.4 }}>
        {surahLabel}
      </span>
    </div>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────
function FooterRosette() {
  const G = '#b89840';
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <ellipse cx="5.5" cy="5.5" rx="2.2" ry="4.5" fill={G} opacity="0.85"/>
      <ellipse cx="5.5" cy="5.5" rx="4.5" ry="2.2" fill={G} opacity="0.85"/>
      <ellipse cx="5.5" cy="5.5" rx="2.2" ry="4.5" transform="rotate(45 5.5 5.5)" fill={G} opacity="0.85"/>
      <ellipse cx="5.5" cy="5.5" rx="2.2" ry="4.5" transform="rotate(-45 5.5 5.5)" fill={G} opacity="0.85"/>
      <circle cx="5.5" cy="5.5" r="1.6" fill="#F8EBD5"/>
    </svg>
  );
}

function MushafFooter({ hizb, page }: { hizb: number; page: number }) {
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px 10px', flexShrink: 0 }}>
      <span style={{ fontSize: 12, color: '#0a0500', fontFamily: UI_FONT, fontWeight: 500, minWidth: 60 }}>
        {hizb ? `الحزب ${hizb}` : ''}
      </span>
      <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <FooterRosette />
        <div style={{ minWidth: 36, height: 20, border: '1.5px solid #b89840', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 7px', background: 'rgba(184,152,64,0.07)' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4a3a1a', fontFamily: UI_FONT, lineHeight: 1 }}>{page}</span>
        </div>
        <FooterRosette />
      </div>
      <span style={{ minWidth: 60 }} />
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
  autoFollow?: boolean;
}

// ── Main component ───────────────────────────────────────────────────────
export default function MushafQCFPage({
  page, currentChapter, currentVerse, isPlaying,
  onVerseClick, onAyahTap, autoFollow,
}: Props) {
  const opening = isOpeningPage(page);
  // "قصار السور" (juz 30, An-Naba → An-Nas) has naturally short ayahs — edge-to-edge
  // CSS word-spacing looks stretched/unnatural there, same as on the opening pages.
  const compact = opening || getPageJuz(page) === 30;

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
    Promise.all([loadQcfFont(data.font), loadQcfFont(QBSML_FONT)]).then(() => {
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
      <div style={{ background: '#F8EBD5', minHeight: '100%', width: '100%', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
        <MushafTopMetadata juz={juz} surahLabel={surahLabel} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`@keyframes ms-spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid rgba(184,152,64,.2)', borderTopColor: '#b89840', animation: 'ms-spin .7s linear infinite' }} />
        </div>
        <MushafFooter hizb={hizb} page={page} />
      </div>
    );
  }

  return (
    <div style={{
      background: '#F8EBD5',
      minHeight: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    }}>
      <div style={{ flexShrink: 0 }}>
        <MushafTopMetadata juz={juz} surahLabel={surahLabel} />
      </div>

      {/* Page body — both opening and regular pages use space-evenly so
          every line slot (text, surah-header, basmala) lands on the grid */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-evenly',
        padding: opening ? '0 18px' : '2px 14px 4px',
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
    /*
     * Each JSON line = exactly ONE physical Mushaf line.
     * flex-wrap:nowrap guarantees no wrapping.
     * justify-content:space-between spreads words to fill the full line width,
     * matching the printed Mushaf look. Short lines (≤2 words) stay centered.
     */
    // 3-tier word spreading to calibrate inter-word spacing:
    //   ≥10 words → space-between (full spread, tight lines)
    //    5–9 words → space-around  (moderate spread)
    //    <5 words  → center        (short lines, opening/juz-30 pages)
    const wCount = words.length;
    const justify = compact ? 'center'
                  : wCount >= 10 ? 'space-between'
                  : wCount >= 5  ? 'space-around'
                  : 'center';
    const fontSize = opening ? 24 : 'clamp(20px, 6vw, 28px)';

    return (
      <div
        key={line.line}
        dir="rtl"
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          justifyContent: justify,
          alignItems: 'baseline',
          direction: 'rtl',
          fontSize,
          lineHeight: 2.1,
          width: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {words.map((word, wi) => {
          const clickable = word.type === 'word' || word.type === 'end';
          const isHl = isPlaying === true && clickable
            && word.surah === currentChapter && word.verse === currentVerse;
          const attachRef = isHl && !hlRefAttached;
          if (attachRef) hlRefAttached = true;

          return (
            <span
              key={wi}
              ref={attachRef ? hlRef : undefined}
              onClick={clickable ? () => {
                const verseText = verseTextMap.get(`${word.surah}:${word.verse}`) ?? word.text;
                onAyahTap?.({ chapterId: word.surah, verseNumber: word.verse, text: verseText });
                onVerseClick?.(word.surah, word.verse);
              } : undefined}
              style={{
                display: 'inline',
                whiteSpace: 'nowrap',
                fontFamily: `"${word.font}"`,
                color: word.type === 'end' ? '#7a5200' : '#010101',
                background: isHl ? 'rgba(190,160,80,0.25)' : 'transparent',
                borderRadius: isHl ? 4 : 0,
                padding: isHl ? '1px 3px' : undefined,
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
}
