'use client';
import { useEffect, useState, useRef } from 'react';

interface MushafWord {
  text: string;
  codeV1: string;
  charType: string;
  verseNumber: number;
  chapterId: number;
  lineNumber: number;
}
interface MushafLineData {
  lineNum: number;
  words: MushafWord[];
}

interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  onVerseClick?: (chapter: number, verse: number) => void;
}

const GOLD    = '#C8A84B';
const GOLD_LT = 'rgba(200,168,75,0.22)';

// ── Font loader ─────────────────────────────────────────────────────────────
function useMushafFont(page: number) {
  const [ready, setReady] = useState(false);
  const family = `QCF4_p${String(page).padStart(3, '0')}`;

  useEffect(() => {
    setReady(false);
    const styleId = `qcf4-${page}`;
    if (document.getElementById(styleId)) { setReady(true); return; }

    const face = new FontFace(
      family,
      `url('/api/tareeq/quran/qcf-font?page=${page}') format('woff2')`,
    );
    face.load()
      .then(f => { (document.fonts as FontFaceSet).add(f); })
      .catch(() => {})
      .finally(() => {
        // inject @font-face so CSS can reference the family by name
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `@font-face{font-family:'${family}';src:url('/api/tareeq/quran/qcf-font?page=${page}')format('woff2');font-display:block;}`;
        document.head.appendChild(style);
        setReady(true);
      });
  }, [page, family]);

  return { family, ready };
}

// ── Surah header decorative frame ───────────────────────────────────────────
function SurahHeader({ words, family }: { words: MushafWord[]; family: string }) {
  const glyph = words.map(w => w.codeV1).join('');
  return (
    <div style={{ margin: '10px 0 6px', position: 'relative', textAlign: 'center' }}>
      {/* Top ornamental bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 0 }}>
        <OrnLine />
        <OrnDiamond />
        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${GOLD}, #a07a20 50%, ${GOLD})` }} />
        <OrnDiamond />
        <OrnLine />
      </div>

      {/* Content row with side bars */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <SideBars />
        <div style={{
          flex: 1, padding: '7px 4px',
          borderLeft: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Surah name glyph from QCF font */}
          <span style={{ fontFamily: family, fontSize: 28, color: '#180e00', lineHeight: 1.8, letterSpacing: 0 }}>
            {glyph}
          </span>
        </div>
        <SideBars flip />
      </div>

      {/* Bottom ornamental bar */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 0 }}>
        <OrnLine />
        <OrnDiamond />
        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${GOLD}, #a07a20 50%, ${GOLD})` }} />
        <OrnDiamond />
        <OrnLine />
      </div>
    </div>
  );
}

// Side column with stacked diamonds
function SideBars({ flip }: { flip?: boolean }) {
  return (
    <div style={{
      width: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      borderTop: `1px solid ${GOLD}`, borderBottom: `1px solid ${GOLD}`,
      gap: 3, padding: '4px 0',
      transform: flip ? 'scaleX(-1)' : undefined,
    }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 6, height: 6, background: GOLD, transform: 'rotate(45deg)', opacity: 0.8 - i * 0.2 }} />
      ))}
    </div>
  );
}

function OrnLine() {
  return <div style={{ width: 14, height: 1.5, background: GOLD }} />;
}
function OrnDiamond() {
  return <div style={{ width: 8, height: 8, background: GOLD, transform: 'rotate(45deg)', flexShrink: 0, margin: '0 2px' }} />;
}

// ── End-of-surah separator ──────────────────────────────────────────────────
function EndOfSurahLine({ words, family }: { words: MushafWord[]; family: string }) {
  const glyph = words.map(w => w.codeV1).join('');
  if (!glyph) return null;
  return (
    <div style={{ textAlign: 'center', margin: '4px 0', color: '#180e00' }}>
      <span style={{ fontFamily: family, fontSize: 22, lineHeight: 2, color: GOLD }}>
        {glyph}
      </span>
    </div>
  );
}

// ── Bismillah line ───────────────────────────────────────────────────────────
function BismillahLine({ words, family }: { words: MushafWord[]; family: string }) {
  const glyph = words.map(w => w.codeV1).join('');
  return (
    <div style={{ textAlign: 'center', margin: '6px 0 2px', direction: 'rtl' }}>
      <span style={{ fontFamily: family, fontSize: 26, lineHeight: 1.8, color: '#180e00' }}>
        {glyph}
      </span>
    </div>
  );
}

// ── Normal Mushaf line ────────────────────────────────────────────────────────
interface LineProps {
  line: MushafLineData;
  family: string;
  currentChapter: number;
  currentVerse: number;
  onVerseClick?: (ch: number, v: number) => void;
  activeRef: React.MutableRefObject<HTMLSpanElement | null>;
}

function MushafLine({ line, family, currentChapter, currentVerse, onVerseClick, activeRef }: LineProps) {
  // Group consecutive words by verse for highlighting
  const groups: { chapterId: number; verseNumber: number; code: string }[] = [];
  for (const w of line.words) {
    const last = groups[groups.length - 1];
    if (last && last.chapterId === w.chapterId && last.verseNumber === w.verseNumber) {
      last.code += w.codeV1;
    } else {
      groups.push({ chapterId: w.chapterId, verseNumber: w.verseNumber, code: w.codeV1 });
    }
  }

  return (
    <div dir="rtl" style={{ textAlign: 'center', lineHeight: '2.15', margin: 0 }}>
      {groups.map((g, i) => {
        const active = g.chapterId === currentChapter && g.verseNumber === currentVerse;
        return (
          <span
            key={i}
            ref={active ? activeRef : null}
            onClick={() => onVerseClick?.(g.chapterId, g.verseNumber)}
            style={{
              fontFamily: family,
              fontSize: 22,
              color: '#180e00',
              background: active ? GOLD_LT : 'transparent',
              borderRadius: 3,
              cursor: 'pointer',
              padding: active ? '1px 3px' : '1px 0',
              transition: 'background 0.25s',
              display: 'inline',
            }}
          >
            {g.code}
          </span>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MushafQCFPage({ page, currentChapter, currentVerse, onVerseClick }: Props) {
  const { family, ready } = useMushafFont(page);
  const [lines, setLines] = useState<MushafLineData[]>([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tareeq/quran/mushaf-lines?page=${page}`)
      .then(r => r.json())
      .then(d => { setLines(d.lines ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  // Scroll active verse into view when verse changes
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentVerse, currentChapter]);

  if (loading || !ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          border: `2px solid ${GOLD_LT}`, borderTopColor: GOLD,
          animation: 'qcf-spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes qcf-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <>
      {/* ── Mushaf page card ─────────────────────────────────────────── */}
      <div style={{
        background: '#FEFAF0',
        borderRadius: 8,
        margin: '8px 10px',
        padding: '14px 12px 18px',
        boxShadow: '0 2px 18px rgba(0,0,0,0.18)',
        border: `1px solid rgba(200,168,75,0.25)`,
        minHeight: 400,
        position: 'relative',
      }}>

        {/* Top page ornament */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
          <div style={{ width: 7, height: 7, background: GOLD, transform: 'rotate(45deg)', margin: '0 5px' }} />
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
        </div>

        {/* Lines */}
        {lines.map((line, idx) => {
          const types = new Set(line.words.map(w => w.charType));

          if (types.has('chapter_name') || types.has('surah_name')) {
            return <SurahHeader key={idx} words={line.words} family={family} />;
          }
          if (types.has('bismillah')) {
            return <BismillahLine key={idx} words={line.words} family={family} />;
          }
          // End of surah: only end-type words, no regular words
          const hasWords = line.words.some(w => w.charType === 'word');
          if (!hasWords && (types.has('end') || types.has('separator'))) {
            return <EndOfSurahLine key={idx} words={line.words} family={family} />;
          }

          return (
            <MushafLine key={idx} line={line} family={family}
              currentChapter={currentChapter} currentVerse={currentVerse}
              onVerseClick={onVerseClick} activeRef={activeRef}
            />
          );
        })}

        {/* Bottom page ornament */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
          <div style={{ width: 7, height: 7, background: GOLD, transform: 'rotate(45deg)', margin: '0 5px' }} />
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
        </div>

        {/* Page number */}
        <div style={{ textAlign: 'center', fontSize: 13, color: '#8a6a20', fontWeight: 700, letterSpacing: 2, marginTop: 2 }}>
          ─ {page} ─
        </div>
      </div>
    </>
  );
}
