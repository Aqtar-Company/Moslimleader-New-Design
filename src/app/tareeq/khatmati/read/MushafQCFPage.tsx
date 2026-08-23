'use client';
import { useEffect, useRef, useState, useMemo } from 'react';

/* ── Static data ─────────────────────────────────────────────────────── */

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

const JUZ_AR = ['','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون','الحادي والعشرون','الثاني والعشرون','الثالث والعشرون','الرابع والعشرون','الخامس والعشرون','السادس والعشرون','السابع والعشرون','الثامن والعشرون','التاسع والعشرون','الثلاثون'];

/* Chapters 1 and 9 have no Bismillah header (per quran.com BismillahSection) */
const NO_BISMILLAH = new Set([1, 9]);

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

function juzName(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `الجزء ${n}`; }
function toEastern(n: number) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]); }

/* ── Decorative helpers ──────────────────────────────────────────────── */

const ORNAMENT = '❖'; // ❖

function GoldLine() {
  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ height: 1.5, background: 'linear-gradient(90deg,transparent,#c8a84b 15%,#c8a84b 85%,transparent)' }} />
      <div style={{ height: 0.5, background: 'linear-gradient(90deg,transparent,#c8a84b 15%,#c8a84b 85%,transparent)', marginTop: 2 }} />
    </div>
  );
}

/* Surah name header — matches quran.com ChapterHeader spirit */
function SurahHeader({ chapterId }: { chapterId: number }) {
  const name = SURAH_AR[chapterId] ?? '';
  return (
    <div style={{
      display: 'block', width: '100%', margin: '12px 0 4px',
      textAlign: 'center',
    }}>
      {/* Ornate frame */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        border: '1px solid rgba(200,168,75,.7)',
        borderRadius: 6,
        padding: '6px 20px',
        background: 'linear-gradient(180deg, rgba(200,168,75,.12) 0%, rgba(200,168,75,.04) 100%)',
        position: 'relative',
      }}>
        {/* Side ornaments */}
        <span style={{ fontSize: 10, color: '#c8a84b', opacity: 0.8 }}>{ORNAMENT}</span>
        <span style={{
          fontFamily: "'Amiri Quran','Scheherazade New',serif",
          fontSize: 17, fontWeight: 700, color: '#4a2e08',
          letterSpacing: '0.03em',
        }}>
          سورة {name}
        </span>
        <span style={{ fontSize: 10, color: '#c8a84b', opacity: 0.8 }}>{ORNAMENT}</span>
      </div>
    </div>
  );
}

/* Bismillah — styled header (shown for all surahs except 1 and 9) */
function BismillahHeader() {
  return (
    <div style={{
      display: 'block', width: '100%', textAlign: 'center',
      margin: '6px 0 8px',
      fontFamily: "'Amiri Quran','Scheherazade New',serif",
      fontSize: 20, color: '#2a1500', lineHeight: 1.8,
      letterSpacing: '0.02em',
    }}>
      {BISMILLAH}
    </div>
  );
}

/* ── Types ───────────────────────────────────────────────────────────── */

interface PageMeta { juz: number | null; hizb: number | null; surahs: number[]; }
interface MushafWord {
  text: string; charType: string;
  verseNumber: number; chapterId: number; lineNumber: number;
}
interface MushafLine { lineNum: number; words: MushafWord[]; }

interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  onVerseClick?: (chapter: number, verse: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  autoFollow?: boolean;
}

/* ── Main component ──────────────────────────────────────────────────── */

export default function MushafQCFPage({ page, currentChapter, currentVerse, onVerseClick, onAyahTap, autoFollow }: Props) {
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ juz: null, hizb: null, surahs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /* Ref for auto-scroll to current verse */
  const hlRef = useRef<HTMLSpanElement | null>(null);
  let hlRefAttached = false;

  const qFont = "'Amiri Quran','Scheherazade New','Traditional Arabic',serif";

  /* Fetch word data grouped by line from the QF-powered mushaf-lines API */
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    fetch(`/api/tareeq/quran/mushaf-lines?page=${page}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        if (cancelled) return;
        if (d.lines) { setLines(d.lines); setMeta(d.meta); }
        else setError(true);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [page]);

  /* Auto-scroll to highlighted verse */
  useEffect(() => {
    if (autoFollow && hlRef.current) {
      hlRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter, currentVerse, autoFollow]);

  /* Flatten & sort all words from all lines */
  const allWords = useMemo((): MushafWord[] =>
    [...lines].sort((a, b) => a.lineNum - b.lineNum).flatMap(l => l.words),
  [lines]);

  const surahLabel = useMemo(
    () => meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و'),
    [meta.surahs],
  );

  return (
    <div style={{
      background: '#F9F4E8', minHeight: '100%',
      display: 'flex', flexDirection: 'column',
      userSelect: 'none', WebkitUserSelect: 'none',
    }}>

      {/* ── Page header: Juz name ◼ Surah name ── */}
      <div style={{ paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
        <GoldLine />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 18px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: qFont }}>
            {meta.juz ? juzName(meta.juz) : ''}
          </span>
          {/* Mushaf icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4V4z" fill="#c8a84b" opacity=".85"/>
            <path d="M20 4h-6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6V4z" fill="#c8a84b" opacity=".5"/>
            <line x1="12" y1="6" x2="12" y2="18" stroke="#fff" strokeWidth=".8"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: qFont }}>
            {surahLabel}
          </span>
        </div>
        <GoldLine />
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`@keyframes ms-spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid rgba(200,168,75,.2)', borderTopColor: '#c8a84b', animation: 'ms-spin .7s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#9a7a40', fontFamily: qFont, fontSize: 14 }}>تعذّر تحميل الصفحة</p>
        </div>
      ) : (
        /*
          Big Text Layout (quran.com mobile pattern):
          - direction: rtl on wrapper
          - text-align: center
          - All words rendered as display:inline spans — natural RTL word-wrap
          - Surah headers inserted as display:block elements to break the flow
          - This matches quran.com's `.mobileInline` + `.mobileCenterText` behavior
        */
        <div
          dir="rtl"
          style={{
            flex: 1,
            padding: '6px 14px 10px',
            direction: 'rtl',
            textAlign: 'center',
            fontFamily: qFont,
            fontSize: 19,
            lineHeight: 2.6,
            color: '#160900',
            overflowX: 'hidden',
          }}
        >
          {(() => {
            const elements: React.ReactNode[] = [];
            let prevChapterId = -1;
            let firstWordOfSurah = false;

            allWords.forEach((word, i) => {
              const isEnd = word.charType === 'end';
              const isHl = !isEnd
                && word.chapterId === currentChapter
                && word.verseNumber === currentVerse;

              /* Insert Surah header + Bismillah when a new surah starts */
              if (word.chapterId !== prevChapterId && word.verseNumber === 1) {
                firstWordOfSurah = true;
                elements.push(
                  <SurahHeader key={`sh-${word.chapterId}`} chapterId={word.chapterId} />,
                );
                if (!NO_BISMILLAH.has(word.chapterId)) {
                  elements.push(<BismillahHeader key={`bm-${word.chapterId}`} />);
                }
                prevChapterId = word.chapterId;
              } else if (word.chapterId !== prevChapterId) {
                prevChapterId = word.chapterId;
              }

              /* Attach scroll ref to first highlighted word */
              const attachRef = isHl && !hlRefAttached;
              if (attachRef) hlRefAttached = true;

              elements.push(
                <span
                  key={i}
                  ref={attachRef ? hlRef : undefined}
                  onClick={() => {
                    if (isEnd) return;
                    onAyahTap?.({ chapterId: word.chapterId, verseNumber: word.verseNumber, text: word.text });
                    onVerseClick?.(word.chapterId, word.verseNumber);
                  }}
                  style={{
                    display: 'inline',
                    fontSize: isEnd ? 14 : 19,
                    color: isEnd ? '#b8922a' : (isHl ? '#2a0f00' : '#160900'),
                    background: isHl ? 'rgba(200,168,75,.28)' : 'transparent',
                    borderRadius: isHl ? 5 : 0,
                    padding: isHl ? '2px 4px' : undefined,
                    cursor: isEnd ? 'default' : 'pointer',
                    transition: 'background .2s, color .15s',
                    WebkitTouchCallout: 'none',
                  }}
                >
                  {word.text}{' '}
                </span>,
              );
            });

            return elements;
          })()}
        </div>
      )}

      {/* ── Page footer: Hizb ◆ page number ◆ ── */}
      <div style={{ paddingTop: 4, paddingBottom: 8, flexShrink: 0 }}>
        <GoldLine />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 18px' }}>
          <span style={{ fontSize: 11, color: '#5a3e10', fontFamily: qFont, fontWeight: 600 }}>
            {meta.hizb ? `الحزب ${toEastern(meta.hizb)}` : ''}
          </span>
          {/* Page number — centered, quran.com PageFooter style */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'rgba(200,168,75,.7)' }}>◆</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#4a2e08', fontFamily: qFont }}>
              {toEastern(page)}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(200,168,75,.7)' }}>◆</span>
          </div>
          <span style={{ fontSize: 11, color: 'transparent' }}>0</span>
        </div>
        <GoldLine />
      </div>

    </div>
  );
}
