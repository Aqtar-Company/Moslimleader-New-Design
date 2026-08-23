'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { getCachedPage, fetchAndCachePage, prefetchPage } from './mushafCache';
import type { PageData } from './mushafCache';

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

const NO_BISMILLAH = new Set([1, 9]);
const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
const AYAH_MARK = '۝'; // U+06DD — Amiri Quran renders it as traditional ayah ornament

function juzName(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `الجزء ${n}`; }
function toEastern(n: number) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]); }

/* ── Gold rule ───────────────────────────────────────────────────────── */
function GoldRule() {
  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ height: 1.5, background: 'linear-gradient(90deg,transparent,#b89840 15%,#b89840 85%,transparent)' }} />
      <div style={{ height: 0.5, background: 'linear-gradient(90deg,transparent,#b89840 15%,#b89840 85%,transparent)', marginTop: 2 }} />
    </div>
  );
}

/* ── Madinah-Mushaf style surah header ───────────────────────────────
 * Three-zone SVG: left geometric band | center text | right geometric band.
 * The diamond-and-connecting-line motif echoes the interlaced geometric
 * borders used in printed Madinah Mushaf section markers.
 */
function SurahHeader({ chapterId }: { chapterId: number }) {
  const name = SURAH_AR[chapterId] ?? '';
  const W = 300, H = 46;
  // diamond helper
  const dia = (cx: number, cy: number, r: number) =>
    `M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy}Z`;

  return (
    <div style={{ display: 'block', width: '100%', margin: '14px 0 2px', textAlign: 'center' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '94%', maxWidth: 300, height: 'auto', display: 'inline-block', overflow: 'visible' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer border + fill */}
        <rect x="1" y="1" width={W - 2} height={H - 2} fill="#f4e9cc" stroke="#b89840" strokeWidth="1.3" rx="1" />

        {/* Left geometric side band (0–72) */}
        <rect x="1" y="1" width="72" height={H - 2} fill="rgba(185,148,48,0.18)" rx="1" />
        {/* Right geometric side band (228–300) */}
        <rect x={W - 73} y="1" width="72" height={H - 2} fill="rgba(185,148,48,0.18)" />
        {/* Separator verticals */}
        <line x1="73" y1="4" x2="73" y2={H - 4} stroke="#b89840" strokeWidth="0.8" />
        <line x1={W - 73} y1="4" x2={W - 73} y2={H - 4} stroke="#b89840" strokeWidth="0.8" />

        {/* Inner thin border on center section */}
        <rect x="74" y="4" width={W - 148} height={H - 8} fill="none" stroke="#b89840" strokeWidth="0.45" />

        {/* Left band: two diamonds linked */}
        <path d={dia(17, H / 2, 8)} fill="rgba(185,148,40,0.28)" stroke="#b89840" strokeWidth="0.7" />
        <circle cx="17" cy={H / 2} r="2.5" fill="#b89840" opacity="0.75" />
        <line x1="25" y1={H / 2} x2="42" y2={H / 2} stroke="#b89840" strokeWidth="0.55" opacity="0.65" />
        <path d={dia(50, H / 2, 8)} fill="rgba(185,148,40,0.28)" stroke="#b89840" strokeWidth="0.7" />
        <circle cx="50" cy={H / 2} r="2.5" fill="#b89840" opacity="0.75" />

        {/* Right band: mirror */}
        <path d={dia(W - 17, H / 2, 8)} fill="rgba(185,148,40,0.28)" stroke="#b89840" strokeWidth="0.7" />
        <circle cx={W - 17} cy={H / 2} r="2.5" fill="#b89840" opacity="0.75" />
        <line x1={W - 25} y1={H / 2} x2={W - 42} y2={H / 2} stroke="#b89840" strokeWidth="0.55" opacity="0.65" />
        <path d={dia(W - 50, H / 2, 8)} fill="rgba(185,148,40,0.28)" stroke="#b89840" strokeWidth="0.7" />
        <circle cx={W - 50} cy={H / 2} r="2.5" fill="#b89840" opacity="0.75" />

        {/* Surah name */}
        <text
          x={W / 2} y={H / 2 + 1}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="'Amiri Quran','Scheherazade New',serif"
          fontSize="15.5" fontWeight="bold" fill="#0a0500"
          letterSpacing="0.04em"
        >
          سورة {name}
        </text>
      </svg>
    </div>
  );
}

/* ── Bismillah line ──────────────────────────────────────────────────── */
function BismillahLine() {
  return (
    <div style={{
      display: 'block', width: '100%', textAlign: 'center',
      margin: '4px 0 6px',
      fontFamily: "'Amiri Quran','Scheherazade New','Traditional Arabic',serif",
      fontSize: 20, color: '#010101', lineHeight: 1.8,
      letterSpacing: '0.02em',
    }}>
      {BISMILLAH}
    </div>
  );
}

/* ── Props ───────────────────────────────────────────────────────────── */
interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  isPlaying?: boolean;
  onVerseClick?: (chapter: number, verse: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  autoFollow?: boolean;
}

/* ── Main component ──────────────────────────────────────────────────── */
export default function MushafQCFPage({
  page, currentChapter, currentVerse, isPlaying,
  onVerseClick, onAyahTap, autoFollow,
}: Props) {

  /*
   * Synchronous cache read — if data for this page is already in the module-level
   * cache (because the carousel pre-fetched it), we derive it directly in render
   * without setState, so there is NO loading state or flash on normal swipes.
   */
  const [localData, setLocalData] = useState<PageData | null>(null);
  const data: PageData | null = getCachedPage(page) ?? localData;
  const loading = !data;

  const hlRef = useRef<HTMLSpanElement | null>(null);
  let hlRefAttached = false;

  const qFont = "'Amiri Quran','Scheherazade New','Traditional Arabic',serif";

  useEffect(() => {
    // Clear stale localData from previous page immediately to avoid wrong content
    setLocalData(null);
    // If the page is already in the module cache, nothing to fetch
    if (getCachedPage(page)) return;

    let cancelled = false;
    fetchAndCachePage(page).then(d => {
      if (!cancelled && d) setLocalData(d);
    });
    return () => { cancelled = true; };
  }, [page]);

  /* Pre-warm surrounding pages while this one is displayed */
  useEffect(() => {
    prefetchPage(page - 2);
    prefetchPage(page - 1);
    prefetchPage(page + 1);
    prefetchPage(page + 2);
  }, [page]);

  /* Auto-scroll to highlighted verse */
  useEffect(() => {
    if (autoFollow && hlRef.current) {
      hlRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter, currentVerse, autoFollow]);

  const allWords = useMemo(() => {
    if (!data) return [];
    return [...data.lines].sort((a, b) => a.lineNum - b.lineNum).flatMap(l => l.words);
  }, [data]);

  const meta = data?.meta ?? { juz: null, hizb: null, surahs: [] };

  const surahLabel = useMemo(
    () => meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و'),
    [meta.surahs],
  );

  return (
    <div style={{
      background: '#F8EBD5',
      minHeight: '100%', width: '100%',
      display: 'flex', flexDirection: 'column',
      userSelect: 'none', WebkitUserSelect: 'none',
    }}>

      {/* ── Metadata header ── */}
      <div style={{ paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
        <GoldRule />
        <div dir="rtl" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 18px',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#72603F', fontFamily: qFont }}>
            {meta.juz ? juzName(meta.juz) : ''}
          </span>
          {/* Madinah Mushaf centre mark — a small geometric rub-el-hizb / star */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 10l-4 2.5 1.5-4.5L2 5.5h4.5z" fill="#b89840" opacity=".7"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#72603F', fontFamily: qFont }}>
            {surahLabel}
          </span>
        </div>
        <GoldRule />
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`@keyframes ms-spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '2px solid rgba(184,152,64,.2)', borderTopColor: '#b89840',
            animation: 'ms-spin .7s linear infinite',
          }} />
        </div>
      ) : (
        <div
          dir="rtl"
          style={{
            flex: 1,
            padding: '6px 14px',
            /*
             * Bottom padding reserves space for the fixed audio player bar (≈72px)
             * plus any device safe-area so the last Quran line is never hidden.
             */
            paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            direction: 'rtl',
            textAlign: 'center',
            fontFamily: qFont,
            fontSize: 19,
            lineHeight: 2.6,
            color: '#010101',
            overflowX: 'hidden',
          }}
        >
          {(() => {
            const els: React.ReactNode[] = [];
            let prevCh = -1;

            allWords.forEach((word, i) => {
              const isEnd = word.charType === 'end';

              /* Surah header + Bismillah at chapter boundary */
              if (word.chapterId !== prevCh && word.verseNumber === 1) {
                els.push(<SurahHeader key={`sh-${word.chapterId}`} chapterId={word.chapterId} />);
                if (!NO_BISMILLAH.has(word.chapterId)) {
                  els.push(<BismillahLine key={`bm-${word.chapterId}`} />);
                }
              }
              prevCh = word.chapterId;

              /*
               * Highlight only when audio is actively playing.
               * Without isPlaying, every word of the initialSurah/initialAyah
               * would be boxed in beige, which looks like broken UI.
               */
              const isHl = isPlaying === true
                && !isEnd
                && word.chapterId === currentChapter
                && word.verseNumber === currentVerse;

              const attachRef = isHl && !hlRefAttached;
              if (attachRef) hlRefAttached = true;

              /* Ayah end-marker: prepend U+06DD so Amiri Quran renders the traditional ornament */
              const txt = isEnd
                ? (word.text.startsWith(AYAH_MARK) ? word.text : `${AYAH_MARK}${word.text}`)
                : word.text;

              els.push(
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
                    fontSize: isEnd ? 17 : 19,
                    color: isEnd ? '#b89840' : '#010101',
                    background: isHl ? 'rgba(190,160,80,0.22)' : 'transparent',
                    borderRadius: isHl ? 4 : 0,
                    padding: isHl ? '1px 3px' : undefined,
                    cursor: isEnd ? 'default' : 'pointer',
                    transition: 'background .15s',
                    WebkitTouchCallout: 'none',
                  }}
                >
                  {txt}{' '}
                </span>,
              );
            });

            return els;
          })()}
        </div>
      )}

      {/* ── Page footer ── */}
      <div style={{ paddingTop: 4, paddingBottom: 8, flexShrink: 0 }}>
        <GoldRule />
        <div dir="rtl" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 18px',
        }}>
          <span style={{ fontSize: 11, color: '#72603F', fontFamily: qFont, fontWeight: 600 }}>
            {meta.hizb ? `الحزب ${toEastern(meta.hizb)}` : ''}
          </span>
          {/* Page number in decorative frame */}
          <svg viewBox="0 0 52 22" style={{ width: 52, height: 22 }}>
            <rect x="1" y="1" width="50" height="20" rx="2" fill="rgba(185,152,64,0.1)" stroke="#b89840" strokeWidth="0.8" />
            <line x1="5" y1="5" x2="47" y2="5" stroke="#b89840" strokeWidth="0.35" opacity="0.6" />
            <line x1="5" y1="17" x2="47" y2="17" stroke="#b89840" strokeWidth="0.35" opacity="0.6" />
            <text x="26" y="13" textAnchor="middle" dominantBaseline="middle"
              fontFamily="'Amiri Quran','Scheherazade New',serif"
              fontSize="11" fontWeight="bold" fill="#010101">
              {toEastern(page)}
            </text>
          </svg>
          <span style={{ fontSize: 11, color: 'transparent', fontFamily: qFont }}>0</span>
        </div>
        <GoldRule />
      </div>

    </div>
  );
}
