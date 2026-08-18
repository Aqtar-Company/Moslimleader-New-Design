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

// ── Static lookups ───────────────────────────────────────────────────────────
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

function toEasternArabic(n: number): string {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
}

// ── Font loader ──────────────────────────────────────────────────────────────
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
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `@font-face{font-family:'${family}';src:url('/api/tareeq/quran/qcf-font?page=${page}')format('woff2');font-display:block;}`;
        document.head.appendChild(style);
        setReady(true);
      });
  }, [page, family]);

  return { family, ready };
}

// ── Surah name banner (ornamental Islamic frame) ─────────────────────────────
function SurahBanner({ words, family }: { words: MushafWord[]; family: string }) {
  const glyph = words.map(w => w.codeV1).join('');
  return (
    <div style={{ margin: '10px 4px 6px', position: 'relative' }}>
      <svg
        viewBox="0 0 320 72" width="100%" height="72"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        preserveAspectRatio="none"
      >
        {/* Dark brown background */}
        <rect x="0" y="0" width="320" height="72" fill="#2d1e0d" rx="3"/>
        {/* Outer gold border */}
        <rect x="2" y="2" width="316" height="68" fill="none" stroke="#c8a84b" strokeWidth="1.5" rx="2"/>
        {/* Inner thin border */}
        <rect x="7" y="7" width="306" height="58" fill="none" stroke="#c8a84b" strokeWidth="0.6" rx="1"/>
        {/* Top center ornament */}
        <polygon points="160,2 164,8 160,14 156,8" fill="#c8a84b"/>
        {/* Bottom center ornament */}
        <polygon points="160,58 164,64 160,70 156,64" fill="#c8a84b"/>
        {/* Left ornaments */}
        <polygon points="2,36 8,30 14,36 8,42" fill="#c8a84b"/>
        {/* Right ornaments */}
        <polygon points="318,36 312,30 306,36 312,42" fill="#c8a84b"/>
        {/* Top corners */}
        <polygon points="2,2 16,2 2,16" fill="#c8a84b" opacity="0.7"/>
        <polygon points="318,2 304,2 318,16" fill="#c8a84b" opacity="0.7"/>
        {/* Bottom corners */}
        <polygon points="2,70 16,70 2,56" fill="#c8a84b" opacity="0.7"/>
        <polygon points="318,70 304,70 318,56" fill="#c8a84b" opacity="0.7"/>
        {/* Horizontal decorative lines */}
        <line x1="20" y1="5" x2="70" y2="5" stroke="#c8a84b" strokeWidth="0.5" opacity="0.6"/>
        <line x1="250" y1="5" x2="300" y2="5" stroke="#c8a84b" strokeWidth="0.5" opacity="0.6"/>
        <line x1="20" y1="67" x2="70" y2="67" stroke="#c8a84b" strokeWidth="0.5" opacity="0.6"/>
        <line x1="250" y1="67" x2="300" y2="67" stroke="#c8a84b" strokeWidth="0.5" opacity="0.6"/>
        {/* Small dots */}
        <circle cx="75" cy="5" r="1.5" fill="#c8a84b" opacity="0.7"/>
        <circle cx="245" cy="5" r="1.5" fill="#c8a84b" opacity="0.7"/>
        <circle cx="75" cy="67" r="1.5" fill="#c8a84b" opacity="0.7"/>
        <circle cx="245" cy="67" r="1.5" fill="#c8a84b" opacity="0.7"/>
      </svg>
      {/* Surah name glyph overlaid */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 72, padding: '0 24px',
      }}>
        <span style={{ fontFamily: family, fontSize: 30, color: '#fff', lineHeight: 1, letterSpacing: 0 }}>
          {glyph}
        </span>
      </div>
    </div>
  );
}

// ── Bismillah line ───────────────────────────────────────────────────────────
function BismillahLine({ words, family }: { words: MushafWord[]; family: string }) {
  const glyph = words.map(w => w.codeV1).join('');
  return (
    <div style={{ textAlign: 'center', padding: '4px 8px 2px', direction: 'rtl' }}>
      <span style={{ fontFamily: family, fontSize: 24, lineHeight: 2, color: '#1a0f00' }}>
        {glyph}
      </span>
    </div>
  );
}

// ── End-of-surah ─────────────────────────────────────────────────────────────
function EndOfSurahLine({ words, family }: { words: MushafWord[]; family: string }) {
  const glyph = words.map(w => w.codeV1).join('');
  if (!glyph) return null;
  return (
    <div style={{ textAlign: 'center', padding: '2px 0', color: '#7a5200' }}>
      <span style={{ fontFamily: family, fontSize: 20, lineHeight: 2 }}>
        {glyph}
      </span>
    </div>
  );
}

// ── Regular Mushaf line ───────────────────────────────────────────────────────
interface LineProps {
  line: MushafLineData;
  family: string;
  currentChapter: number;
  currentVerse: number;
  onVerseClick?: (ch: number, v: number) => void;
  activeRef: React.MutableRefObject<HTMLSpanElement | null>;
}

function MushafLine({ line, family, currentChapter, currentVerse, onVerseClick, activeRef }: LineProps) {
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
    <div dir="rtl" style={{ textAlign: 'justify', textAlignLast: 'justify', lineHeight: '2.1', padding: '0 6px' }}>
      {groups.map((g, i) => {
        const active = g.chapterId === currentChapter && g.verseNumber === currentVerse;
        return (
          <span
            key={i}
            ref={active ? activeRef : null}
            onClick={() => onVerseClick?.(g.chapterId, g.verseNumber)}
            style={{
              fontFamily: family,
              fontSize: 23,
              color: '#1a0f00',
              background: active ? 'rgba(200,168,75,0.28)' : 'transparent',
              borderRadius: 2,
              cursor: 'pointer',
              padding: active ? '0 2px' : '0',
              transition: 'background 0.2s',
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
  const [meta, setMeta] = useState<PageMeta>({ juz: null, hizb: null, surahs: [] });
  const [loading, setLoading] = useState(true);
  const activeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tareeq/quran/mushaf-lines?page=${page}`)
      .then(r => r.json())
      .then(d => {
        setLines(d.lines ?? []);
        if (d.meta) setMeta(d.meta);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentVerse, currentChapter]);

  if (loading || !ready) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 300, gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2.5px solid rgba(200,168,75,0.2)', borderTopColor: '#c8a84b',
          animation: 'qcf-spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes qcf-spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ fontSize: 13, color: 'var(--tr-text-muted)' }}>جاري تحميل الصفحة...</span>
      </div>
    );
  }

  // Surah label for header: all surah names on this page
  const surahLabel = meta.surahs.length > 0
    ? meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' والكهف'.includes(' و') ? ' و' : ' و')
    : (SURAH_AR[currentChapter] ?? '');

  // When multiple surahs on the page, show "X والY" style
  const surahHeaderLabel = meta.surahs.length > 1
    ? meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و')
    : (SURAH_AR[meta.surahs[0] ?? currentChapter] ?? '');

  return (
    <div style={{
      background: '#F9F3E3',
      minHeight: '100%',
      fontFamily: 'serif',
    }}>
      {/* ── Page card ── */}
      <div style={{
        background: '#FAF6ED',
        margin: '6px 8px 10px',
        borderRadius: 4,
        boxShadow: '0 3px 20px rgba(0,0,0,0.22)',
        border: '1px solid rgba(180,140,50,0.3)',
        overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{ padding: '8px 10px 4px' }}>
          {/* Outer border line */}
          <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginBottom: 3 }} />
          <div style={{ height: 0.6, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginBottom: 5 }} />

          {/* Header content: juz | icon | surah */}
          <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: 'serif', letterSpacing: 0.3 }}>
              {meta.juz ? juzName(meta.juz) : ''}
            </span>
            {/* Quran book icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4V4z" fill="#c8a84b" opacity="0.85"/>
              <path d="M20 4h-6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6V4z" fill="#c8a84b" opacity="0.55"/>
              <line x1="12" y1="6" x2="12" y2="18" stroke="#fff" strokeWidth="0.8"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: 'serif', letterSpacing: 0.3 }}>
              {surahHeaderLabel}
            </span>
          </div>

          <div style={{ height: 0.6, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 5 }} />
          <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 3 }} />
        </div>

        {/* ── Lines ── */}
        <div style={{ padding: '2px 6px 0' }}>
          {lines.map((line, idx) => {
            const types = new Set(line.words.map(w => w.charType));
            if (types.has('chapter_name') || types.has('surah_name')) {
              return <SurahBanner key={idx} words={line.words} family={family} />;
            }
            if (types.has('bismillah')) {
              return <BismillahLine key={idx} words={line.words} family={family} />;
            }
            const hasWords = line.words.some(w => w.charType === 'word' || w.charType === 'end');
            if (!hasWords) {
              return <EndOfSurahLine key={idx} words={line.words} family={family} />;
            }
            return (
              <MushafLine
                key={idx}
                line={line}
                family={family}
                currentChapter={currentChapter}
                currentVerse={currentVerse}
                onVerseClick={onVerseClick}
                activeRef={activeRef}
              />
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '4px 10px 8px' }}>
          <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginBottom: 3 }} />
          <div style={{ height: 0.6, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginBottom: 5 }} />

          <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            {/* Hizb (right in RTL) */}
            <span style={{ fontSize: 10, fontWeight: 700, color: '#5a3e10', fontFamily: 'serif' }}>
              {meta.hizb ? `الحزب ${toEasternArabic(meta.hizb)}` : ''}
            </span>

            {/* Page number with ornamental diamonds (center) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, color: '#c8a84b' }}>◆</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#5a3e10', fontFamily: 'serif', fontVariantNumeric: 'tabular-nums' }}>
                {toEasternArabic(page)}
              </span>
              <span style={{ fontSize: 9, color: '#c8a84b' }}>◆</span>
            </div>

            {/* Empty right side (or could show رقم الحزب الفرعي) */}
            <span style={{ fontSize: 10, color: 'transparent' }}>0</span>
          </div>

          <div style={{ height: 0.6, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 5 }} />
          <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, #c8a84b 20%, #c8a84b 80%, transparent)', marginTop: 3 }} />
        </div>
      </div>
    </div>
  );
}
