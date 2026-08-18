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

// ── Surah banner ─────────────────────────────────────────────────────────────
function SurahBanner({ surahId }: { surahId: number }) {
  const name = SURAH_AR[surahId] ?? '';
  return (
    <div style={{ margin: '12px 0 6px', position: 'relative' }}>
      <svg viewBox="0 0 320 64" width="100%" height="64" xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        preserveAspectRatio="none">
        <rect x="0" y="0" width="320" height="64" fill="#2e1e0b" rx="2"/>
        <rect x="2" y="2" width="316" height="60" fill="none" stroke="#c8a84b" strokeWidth="1.5" rx="1.5"/>
        <rect x="7" y="7" width="306" height="50" fill="none" stroke="#c8a84b" strokeWidth="0.5" rx="1"/>
        <polygon points="160,2 165,8 160,14 155,8" fill="#c8a84b"/>
        <polygon points="160,50 165,56 160,62 155,56" fill="#c8a84b"/>
        <polygon points="2,32 8,26 14,32 8,38" fill="#c8a84b"/>
        <polygon points="318,32 312,26 306,32 312,38" fill="#c8a84b"/>
        <polygon points="2,2 16,2 2,16" fill="#c8a84b" opacity="0.6"/>
        <polygon points="318,2 304,2 318,16" fill="#c8a84b" opacity="0.6"/>
        <polygon points="2,62 16,62 2,48" fill="#c8a84b" opacity="0.6"/>
        <polygon points="318,62 304,62 318,48" fill="#c8a84b" opacity="0.6"/>
        <line x1="20" y1="5" x2="62" y2="5" stroke="#c8a84b" strokeWidth="0.5" opacity="0.5"/>
        <line x1="258" y1="5" x2="300" y2="5" stroke="#c8a84b" strokeWidth="0.5" opacity="0.5"/>
        <line x1="20" y1="59" x2="62" y2="59" stroke="#c8a84b" strokeWidth="0.5" opacity="0.5"/>
        <line x1="258" y1="59" x2="300" y2="59" stroke="#c8a84b" strokeWidth="0.5" opacity="0.5"/>
      </svg>
      <div style={{ position: 'relative', zIndex: 1, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: QURAN_FONT, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
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
  activeRef: React.MutableRefObject<HTMLSpanElement | null>;
}

function QuranTextBlock({ verses, currentChapter, currentVerse, onVerseClick, activeRef }: TextBlockProps) {
  return (
    <div dir="rtl" style={{
      padding: '0 14px',
      fontFamily: QURAN_FONT,
      fontSize: 19,
      lineHeight: 2.65,
      color: '#1a0e00',
      textAlign: 'justify',
      wordSpacing: 4,
    }}>
      {verses.map((v, vi) => {
        const active = v.chapterId === currentChapter && v.verseNumber === currentVerse;
        return (
          <span
            key={`${v.chapterId}-${v.verseNumber}`}
            ref={active ? activeRef : null}
            onClick={() => onVerseClick?.(v.chapterId, v.verseNumber)}
            style={{
              background: active ? 'rgba(180,140,40,0.22)' : 'transparent',
              borderRadius: active ? 4 : 0,
              cursor: 'pointer',
              display: 'inline',
              transition: 'background 0.25s',
            }}
          >
            {vi > 0 ? ' ' : ''}
            {v.text}
            {' '}
            <span style={{
              fontFamily: QURAN_FONT,
              fontSize: '0.78em',
              color: active ? '#7a4e00' : '#8B6914',
              display: 'inline',
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
export default function MushafQCFPage({ page, currentChapter, currentVerse, onVerseClick }: Props) {
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
    if (activeRef.current) activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentVerse, currentChapter]);

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
