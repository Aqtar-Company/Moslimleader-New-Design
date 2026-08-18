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
interface PageMeta {
  juz: number | null;
  hizb: number | null;
  surahs: number[];
}

interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  onVerseClick?: (chapter: number, verse: number) => void;
}

const SURAH_AR: Record<number, string> = {
  1:'الفاتحة',2:'البقرة',3:'آل عمران',4:'النساء',5:'المائدة',
  6:'الأنعام',7:'الأعراف',8:'الأنفال',9:'التوبة',10:'يونس',
  11:'هود',12:'يوسف',13:'الرعد',14:'إبراهيم',15:'الحجر',
  16:'النحل',17:'الإسراء',18:'الكهف',19:'مريم',20:'طه',
  21:'الأنبياء',22:'الحج',23:'المؤمنون',24:'النور',25:'الفرقان',
  26:'الشعراء',27:'النمل',28:'القصص',29:'العنكبوت',30:'الروم',
  31:'لقمان',32:'السجدة',33:'الأحزاب',34:'سبأ',35:'فاطر',
  36:'يس',37:'الصافات',38:'ص',39:'الزمر',40:'غافر',
  41:'فصلت',42:'الشورى',43:'الزخرف',44:'الدخان',45:'الجاثية',
  46:'الأحقاف',47:'محمد',48:'الفتح',49:'الحجرات',50:'ق',
  51:'الذاريات',52:'الطور',53:'النجم',54:'القمر',55:'الرحمن',
  56:'الواقعة',57:'الحديد',58:'المجادلة',59:'الحشر',60:'الممتحنة',
  61:'الصف',62:'الجمعة',63:'المنافقون',64:'التغابن',65:'الطلاق',
  66:'التحريم',67:'الملك',68:'القلم',69:'الحاقة',70:'المعارج',
  71:'نوح',72:'الجن',73:'المزمل',74:'المدثر',75:'القيامة',
  76:'الإنسان',77:'المرسلات',78:'النبأ',79:'النازعات',80:'عبس',
  81:'التكوير',82:'الانفطار',83:'المطففين',84:'الانشقاق',85:'البروج',
  86:'الطارق',87:'الأعلى',88:'الغاشية',89:'الفجر',90:'البلد',
  91:'الشمس',92:'الليل',93:'الضحى',94:'الشرح',95:'التين',
  96:'العلق',97:'القدر',98:'البينة',99:'الزلزلة',100:'العاديات',
  101:'القارعة',102:'التكاثر',103:'العصر',104:'الهمزة',105:'الفيل',
  106:'قريش',107:'الماعون',108:'الكوثر',109:'الكافرون',110:'النصر',
  111:'المسد',112:'الإخلاص',113:'الفلق',114:'الناس',
};

const JUZ_AR = [
  '','الأول','الثاني','الثالث','الرابع','الخامس',
  'السادس','السابع','الثامن','التاسع','العاشر',
  'الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر',
  'السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون',
  'الحادي والعشرون','الثاني والعشرون','الثالث والعشرون','الرابع والعشرون','الخامس والعشرون',
  'السادس والعشرون','السابع والعشرون','الثامن والعشرون','التاسع والعشرون','الثلاثون',
];

function juzName(n: number) {
  return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `الجزء ${n}`;
}
function toEastern(n: number) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
}

// Naskh font stack for fallback rendering
const NASKH = `'Noto Naskh Arabic', 'Arabic Typesetting', 'Scheherazade New', serif`;

// ── Font loader ──────────────────────────────────────────────────────────────
function useMushafFont(page: number) {
  const [fontOk, setFontOk] = useState(false);
  const [ready, setReady] = useState(false);
  const family = `QCF4_p${String(page).padStart(3, '0')}`;

  useEffect(() => {
    setReady(false);
    setFontOk(false);
    const styleId = `qcf4-${page}`;
    if (document.getElementById(styleId)) {
      setFontOk(true); setReady(true); return;
    }
    const face = new FontFace(family, `url('/api/tareeq/quran/qcf-font?page=${page}') format('woff2')`);
    face.load()
      .then(f => {
        (document.fonts as FontFaceSet).add(f);
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = `@font-face{font-family:'${family}';src:url('/api/tareeq/quran/qcf-font?page=${page}')format('woff2');font-display:block;}`;
        document.head.appendChild(s);
        setFontOk(true);
      })
      .catch(() => setFontOk(false))
      .finally(() => setReady(true));
  }, [page, family]);

  return { family, fontOk, ready };
}

// ── Surah name banner ────────────────────────────────────────────────────────
function SurahBanner({ words, family, fontOk, surahId }: {
  words: MushafWord[]; family: string; fontOk: boolean; surahId: number;
}) {
  const glyph = words.map(w => w.codeV1).join('');
  const name = SURAH_AR[surahId] ?? '';
  return (
    <div style={{ margin: '10px 0 6px', position: 'relative' }}>
      <svg viewBox="0 0 320 68" width="100%" height="68" xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        preserveAspectRatio="none">
        <rect x="0" y="0" width="320" height="68" fill="#2e1e0b" rx="2"/>
        <rect x="2" y="2" width="316" height="64" fill="none" stroke="#c8a84b" strokeWidth="1.5" rx="1.5"/>
        <rect x="7" y="7" width="306" height="54" fill="none" stroke="#c8a84b" strokeWidth="0.5" rx="1"/>
        <polygon points="160,2 165,9 160,16 155,9" fill="#c8a84b"/>
        <polygon points="160,52 165,59 160,66 155,59" fill="#c8a84b"/>
        <polygon points="2,34 9,27 16,34 9,41" fill="#c8a84b"/>
        <polygon points="318,34 311,27 304,34 311,41" fill="#c8a84b"/>
        <polygon points="2,2 18,2 2,18" fill="#c8a84b" opacity="0.6"/>
        <polygon points="318,2 302,2 318,18" fill="#c8a84b" opacity="0.6"/>
        <polygon points="2,66 18,66 2,50" fill="#c8a84b" opacity="0.6"/>
        <polygon points="318,66 302,66 318,50" fill="#c8a84b" opacity="0.6"/>
        <line x1="22" y1="5" x2="65" y2="5" stroke="#c8a84b" strokeWidth="0.5" opacity="0.5"/>
        <line x1="255" y1="5" x2="298" y2="5" stroke="#c8a84b" strokeWidth="0.5" opacity="0.5"/>
        <line x1="22" y1="63" x2="65" y2="63" stroke="#c8a84b" strokeWidth="0.5" opacity="0.5"/>
        <line x1="255" y1="63" x2="298" y2="63" stroke="#c8a84b" strokeWidth="0.5" opacity="0.5"/>
      </svg>
      <div style={{ position: 'relative', zIndex: 1, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
        {fontOk && glyph ? (
          <span style={{ fontFamily: `'${family}'`, fontSize: 28, color: '#fff', lineHeight: 1 }}>
            {glyph}
          </span>
        ) : (
          <span style={{ fontFamily: NASKH, fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
            سورة {name}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Bismillah line ────────────────────────────────────────────────────────────
function BismillahLine({ words, family, fontOk }: { words: MushafWord[]; family: string; fontOk: boolean }) {
  const glyph = words.map(w => w.codeV1).join('');
  return (
    <div style={{ textAlign: 'center', padding: '4px 0 2px', direction: 'rtl' }}>
      {fontOk && glyph ? (
        <span style={{ fontFamily: `'${family}'`, fontSize: 24, lineHeight: 2, color: '#1a0e00' }}>{glyph}</span>
      ) : (
        <span style={{ fontFamily: NASKH, fontSize: 18, lineHeight: 2.2, color: '#1a0e00' }}>
          بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ
        </span>
      )}
    </div>
  );
}

// ── Regular line ──────────────────────────────────────────────────────────────
interface LineProps {
  line: MushafLineData;
  family: string;
  fontOk: boolean;
  currentChapter: number;
  currentVerse: number;
  onVerseClick?: (ch: number, v: number) => void;
  activeRef: React.MutableRefObject<HTMLSpanElement | null>;
}

function MushafLine({ line, family, fontOk, currentChapter, currentVerse, onVerseClick, activeRef }: LineProps) {
  const groups: { chapterId: number; verseNumber: number; code: string; words: string[] }[] = [];
  for (const w of line.words) {
    const last = groups[groups.length - 1];
    if (last && last.chapterId === w.chapterId && last.verseNumber === w.verseNumber) {
      last.code += w.codeV1;
      if (w.text) last.words.push(w.text);
    } else {
      groups.push({ chapterId: w.chapterId, verseNumber: w.verseNumber, code: w.codeV1, words: w.text ? [w.text] : [] });
    }
  }

  return (
    <div dir="rtl" style={{
      /* white-space: nowrap prevents browser from word-wrapping — page layout stays fixed */
      whiteSpace: 'nowrap',
      overflow: 'visible',
      lineHeight: fontOk ? '1.95' : '2.3',
      padding: '0 10px',
    }}>
      {groups.map((g, i) => {
        const active = g.chapterId === currentChapter && g.verseNumber === currentVerse;
        return (
          <span key={i}
            ref={active ? activeRef : null}
            onClick={() => onVerseClick?.(g.chapterId, g.verseNumber)}
            style={{
              fontFamily: fontOk ? `'${family}'` : NASKH,
              fontSize: fontOk ? 22 : 17,
              color: active ? '#7a4e00' : '#1a0e00',
              background: active ? 'rgba(180,140,40,0.18)' : 'transparent',
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.15s',
              display: 'inline',
            }}>
            {fontOk ? g.code : (i > 0 ? ' ' + g.words.join(' ') : g.words.join(' '))}
          </span>
        );
      })}
    </div>
  );
}

// ── End-of-surah ──────────────────────────────────────────────────────────────
function EndLine({ words, family, fontOk }: { words: MushafWord[]; family: string; fontOk: boolean }) {
  const glyph = words.map(w => w.codeV1).join('');
  if (!fontOk || !glyph) return null;
  return (
    <div style={{ textAlign: 'center', padding: '2px 0', color: '#7a5200' }}>
      <span style={{ fontFamily: `'${family}'`, fontSize: 20, lineHeight: 2 }}>{glyph}</span>
    </div>
  );
}

// Fixed internal render width — the page scales to fit the viewport, never reflows
const INTERNAL_W = 380;

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MushafQCFPage({ page, currentChapter, currentVerse, onVerseClick }: Props) {
  const { family, fontOk, ready } = useMushafFont(page);
  const [lines, setLines] = useState<MushafLineData[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ juz: null, hizb: null, surahs: [] });
  const [loading, setLoading] = useState(true);
  const activeRef = useRef<HTMLSpanElement | null>(null);

  // Scale the whole Mushaf page to fit the container — like a PDF page render
  const wrapRef  = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale,  setScale]  = useState(1);
  const [innerH, setInnerH] = useState(0);

  useEffect(() => {
    const outer = wrapRef.current;
    if (!outer) return;
    const update = () => {
      const w = outer.offsetWidth;
      if (w > 0) setScale(w / INTERNAL_W);
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(outer);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (innerRef.current && lines.length > 0) {
      setInnerH(innerRef.current.offsetHeight);
    }
  }, [lines, ready]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tareeq/quran/mushaf-lines?page=${page}`)
      .then(r => r.json())
      .then(d => { setLines(d.lines ?? []); if (d.meta) setMeta(d.meta); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentVerse, currentChapter]);

  const surahHeaderLabel = meta.surahs.length > 1
    ? meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و')
    : (SURAH_AR[meta.surahs[0] ?? currentChapter] ?? '');

  if (loading || !ready) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2.5px solid rgba(200,168,75,0.2)', borderTopColor: '#c8a84b', animation: 'ms-spin 0.7s linear infinite' }} />
        <style>{`@keyframes ms-spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ fontSize: 13, color: '#8a7050', fontFamily: NASKH }}>جاري تحميل الصفحة…</span>
      </div>
    );
  }

  return (
    /* Outer ref measures available width; height compensates for the CSS transform gap */
    <div ref={wrapRef} style={{ width: '100%', height: innerH > 0 ? innerH * scale : 'auto', overflow: 'hidden' }}>
    <div ref={innerRef} style={{
      width: INTERNAL_W,
      transformOrigin: 'top left',
      transform: `scale(${scale.toFixed(5)})`,
      background: '#F9F4E8',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{ padding: '6px 12px 2px' }}>
        <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)' }} />
        <div style={{ height: 0.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 2 }} />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 4px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: NASKH }}>
            {meta.juz ? juzName(meta.juz) : ''}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4V4z" fill="#c8a84b" opacity="0.85"/>
            <path d="M20 4h-6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6V4z" fill="#c8a84b" opacity="0.5"/>
            <line x1="12" y1="6" x2="12" y2="18" stroke="#fff" strokeWidth="0.8"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: NASKH }}>
            {surahHeaderLabel}
          </span>
        </div>
        <div style={{ height: 0.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)' }} />
        <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 2 }} />
      </div>

      {/* ── Lines ── */}
      <div style={{ flex: 1, padding: '2px 0' }}>
        {lines.map((line, idx) => {
          const types = new Set(line.words.map(w => w.charType));
          const surahId = line.words[0]?.chapterId ?? currentChapter;

          if (types.has('chapter_name') || types.has('surah_name')) {
            return <SurahBanner key={idx} words={line.words} family={family} fontOk={fontOk} surahId={surahId} />;
          }
          if (types.has('bismillah')) {
            return <BismillahLine key={idx} words={line.words} family={family} fontOk={fontOk} />;
          }
          const hasWords = line.words.some(w => w.charType === 'word' || w.charType === 'end');
          if (!hasWords) {
            return <EndLine key={idx} words={line.words} family={family} fontOk={fontOk} />;
          }
          return (
            <MushafLine key={idx} line={line} family={family} fontOk={fontOk}
              currentChapter={currentChapter} currentVerse={currentVerse}
              onVerseClick={onVerseClick} activeRef={activeRef}
            />
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '2px 12px 8px' }}>
        <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)' }} />
        <div style={{ height: 0.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 2 }} />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 4px' }}>
          <span style={{ fontSize: 11, color: '#5a3e10', fontFamily: NASKH, fontWeight: 600 }}>
            {meta.hizb ? `الحزب ${toEastern(meta.hizb)}` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#c8a84b' }}>◆</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#5a3e10', fontFamily: NASKH }}>
              {toEastern(page)}
            </span>
            <span style={{ fontSize: 9, color: '#c8a84b' }}>◆</span>
          </div>
          <span style={{ fontSize: 11, color: 'transparent' }}>0</span>
        </div>
        <div style={{ height: 0.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)' }} />
        <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 2 }} />
      </div>
    </div>
    </div>
  );
}
