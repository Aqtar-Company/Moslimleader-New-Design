'use client';
import { useEffect, useState, useRef, useMemo } from 'react';

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
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  autoFollow?: boolean;
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

const QURAN_FONT = `'Amiri Quran', 'Scheherazade New', 'Traditional Arabic', serif`;
const LABEL_FONT = `'Amiri', 'Scheherazade New', serif`;

// ── Page segments ────────────────────────────────────────────────────────────
interface VerseGroup {
  chapterId: number;
  verseNumber: number;
  text: string;
}
type PageSegment =
  | { type: 'surah'; id: number }
  | { type: 'bismillah' }
  | { type: 'break' }
  | { type: 'text'; verses: VerseGroup[] };

function buildSegments(lines: MushafLineData[]): PageSegment[] {
  const segments: PageSegment[] = [];
  let currentVerses: VerseGroup[] = [];

  const flush = () => {
    if (currentVerses.length > 0) {
      segments.push({ type: 'text', verses: currentVerses });
      currentVerses = [];
    }
  };

  for (const line of lines) {
    const types = new Set(line.words.map(w => w.charType));

    if (types.has('chapter_name') || types.has('surah_name')) {
      flush();
      segments.push({ type: 'surah', id: line.words[0]?.chapterId ?? 0 });
      continue;
    }

    if (types.has('bismillah')) {
      flush();
      segments.push({ type: 'bismillah' });
      continue;
    }

    const hasWords = line.words.some(w => w.charType === 'word' || w.charType === 'end');
    if (!hasWords) {
      flush();
      segments.push({ type: 'break' });
      continue;
    }

    for (const w of line.words) {
      if (w.charType === 'end') continue; // replaced by our own inline ornament
      if (!w.text?.trim()) continue;
      const last = currentVerses[currentVerses.length - 1];
      if (last && last.chapterId === w.chapterId && last.verseNumber === w.verseNumber) {
        last.text += ' ' + w.text;
      } else {
        currentVerses.push({ chapterId: w.chapterId, verseNumber: w.verseNumber, text: w.text });
      }
    }
  }

  flush();
  return segments;
}

// ── Surah banner — uses uploaded ornamental SVG frame ────────────────────────
function SurahBanner({ surahId }: { surahId: number }) {
  const name = SURAH_AR[surahId] ?? '';
  return (
    <div dir="rtl" style={{ margin: '14px 6px 8px', position: 'relative', lineHeight: 0 }}>
      {/* The uploaded gold frame SVG from public/surah_header_mushaf.svg */}
      <img
        src="/surah_header_mushaf.svg"
        alt=""
        aria-hidden="true"
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: QURAN_FONT,
          fontSize: 'clamp(13px, 3.8vw, 20px)',
          fontWeight: 700,
          color: '#1a0800',
          letterSpacing: 2,
          lineHeight: 1,
        }}>
          سورة {name}
        </span>
      </div>
    </div>
  );
}

// ── Bismillah ────────────────────────────────────────────────────────────────
function BismillahLine() {
  return (
    <div style={{ textAlign: 'center', padding: '8px 14px 4px', direction: 'rtl' }}>
      <span style={{ fontFamily: QURAN_FONT, fontSize: 21, lineHeight: 2.4, color: '#1a0e00' }}>
        بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِیمِ
      </span>
    </div>
  );
}

// ── End-of-surah ornament ────────────────────────────────────────────────────
function EndLine() {
  return (
    <div style={{ textAlign: 'center', padding: '6px 0 8px', color: '#c8a84b', fontSize: 15, letterSpacing: 8, fontFamily: QURAN_FONT }}>
      ❧ ﴾ ❧
    </div>
  );
}

// ── Continuous Quran text block ──────────────────────────────────────────────
interface TextBlockProps {
  verses: VerseGroup[];
  currentChapter: number;
  currentVerse: number;
  onVerseClick?: (ch: number, v: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  activeRef: React.MutableRefObject<HTMLSpanElement | null>;
}

function QuranTextBlock({ verses, currentChapter, currentVerse, onVerseClick, onAyahTap, activeRef }: TextBlockProps) {
  return (
    <div dir="rtl" style={{
      padding: '2px 16px 4px',
      fontFamily: QURAN_FONT,
      fontSize: 20,
      lineHeight: 2.8,
      color: '#1a0800',
      textAlign: 'justify',
      wordSpacing: 3,
    }}>
      {verses.map((v, vi) => {
        const active = v.chapterId === currentChapter && v.verseNumber === currentVerse;
        return (
          <span
            key={`${v.chapterId}-${v.verseNumber}`}
            ref={active ? activeRef : null}
            onClick={() => onVerseClick?.(v.chapterId, v.verseNumber)}
            style={{
              background: active ? 'rgba(171,136,68,0.18)' : 'transparent',
              borderRadius: 5,
              padding: active ? '1px 3px' : '0',
              cursor: 'pointer',
              display: 'inline',
              transition: 'background 0.3s',
            }}
          >
            {vi > 0 ? ' ' : ''}
            {v.text}
            {' '}
            <span
              onClick={(e) => { e.stopPropagation(); onAyahTap?.({ chapterId: v.chapterId, verseNumber: v.verseNumber, text: v.text }); }}
              style={{
                fontFamily: QURAN_FONT,
                fontSize: '0.72em',
                verticalAlign: 'middle',
                color: active ? '#6b3e00' : '#9b7830',
                display: 'inline',
                cursor: onAyahTap ? 'pointer' : 'default',
                padding: '1px 2px',
                borderRadius: 3,
              }}>
              {'۝'}{toEastern(v.verseNumber)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function MushafQCFPage({ page, currentChapter, currentVerse, onVerseClick, onAyahTap, autoFollow = true }: Props) {
  const [lines, setLines] = useState<MushafLineData[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ juz: null, hizb: null, surahs: [] });
  const [loading, setLoading] = useState(true);
  const activeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tareeq/quran/mushaf-lines?page=${page}`)
      .then(r => r.json())
      .then(d => { setLines(d.lines ?? []); if (d.meta) setMeta(d.meta); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    if (autoFollow && activeRef.current) activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentVerse, currentChapter, autoFollow]);

  const segments = useMemo(() => buildSegments(lines), [lines]);

  const surahHeaderLabel = meta.surahs.length > 1
    ? meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و')
    : (SURAH_AR[meta.surahs[0] ?? currentChapter] ?? '');

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <style>{`@keyframes ms-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2.5px solid rgba(200,168,75,0.2)', borderTopColor: '#c8a84b', animation: 'ms-spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ background: '#F9F4E8', minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '0 2px' }}>

      {/* ── Header ── */}
      <div style={{ padding: '6px 12px 2px' }}>
        <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)' }} />
        <div style={{ height: 0.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 2 }} />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 4px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: LABEL_FONT }}>
            {meta.juz ? juzName(meta.juz) : ''}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4V4z" fill="#c8a84b" opacity="0.85"/>
            <path d="M20 4h-6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6V4z" fill="#c8a84b" opacity="0.5"/>
            <line x1="12" y1="6" x2="12" y2="18" stroke="#fff" strokeWidth="0.8"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: LABEL_FONT }}>
            {surahHeaderLabel}
          </span>
        </div>
        <div style={{ height: 0.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)' }} />
        <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 2 }} />
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: '4px 0' }}>
        {segments.map((seg, idx) => {
          if (seg.type === 'surah')    return <SurahBanner key={idx} surahId={seg.id} />;
          if (seg.type === 'bismillah') return <BismillahLine key={idx} />;
          if (seg.type === 'break')    return <EndLine key={idx} />;
          return (
            <QuranTextBlock
              key={idx}
              verses={seg.verses}
              currentChapter={currentChapter}
              currentVerse={currentVerse}
              onVerseClick={onVerseClick}
              onAyahTap={onAyahTap}
              activeRef={activeRef}
            />
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '2px 12px 8px' }}>
        <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)' }} />
        <div style={{ height: 0.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 2 }} />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 4px' }}>
          <span style={{ fontSize: 11, color: '#5a3e10', fontFamily: LABEL_FONT, fontWeight: 600 }}>
            {meta.hizb ? `الحزب ${toEastern(meta.hizb)}` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#c8a84b' }}>◆</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#5a3e10', fontFamily: LABEL_FONT }}>
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
  );
}
