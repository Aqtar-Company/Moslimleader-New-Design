'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { getCachedPage, fetchAndCachePage, prefetchPage, type PageData } from './mushafCache';

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

/* Chapters 1 and 9 have no Bismillah header */
const NO_BISMILLAH = new Set([1, 9]);

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
/* Unicode Ayah End marker — Amiri Quran renders it as the traditional enclosing ornament */
const AYAH_MARK = '۝';

function juzName(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `الجزء ${n}`; }
function toEastern(n: number) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]); }

/* ── Decorative helpers ──────────────────────────────────────────────── */

function GoldLine() {
  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ height: 1.5, background: 'linear-gradient(90deg,transparent,#c8a84b 15%,#c8a84b 85%,transparent)' }} />
      <div style={{ height: 0.5, background: 'linear-gradient(90deg,transparent,#c8a84b 15%,#c8a84b 85%,transparent)', marginTop: 2 }} />
    </div>
  );
}

/* Authentic Madinah-Mushaf style surah header — SVG ornamental frame */
function SurahHeader({ chapterId }: { chapterId: number }) {
  const name = SURAH_AR[chapterId] ?? '';
  const W = 280, H = 50;
  const op = 3;   // outer padding from edge
  const ip = 7;   // inner border inset

  return (
    <div style={{ display: 'block', width: '100%', margin: '14px 0 2px', textAlign: 'center' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '90%', maxWidth: 280, height: 'auto', display: 'inline-block', overflow: 'visible' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer rect with subtle fill */}
        <rect x={op} y={op} width={W - op * 2} height={H - op * 2}
          fill="rgba(200,168,75,0.07)" stroke="#c8a84b" strokeWidth="1.4" />
        {/* Inner rect — thinner, slightly inset */}
        <rect x={ip} y={ip} width={W - ip * 2} height={H - ip * 2}
          fill="none" stroke="#c8a84b" strokeWidth="0.6" />

        {/* Corner bracket ornaments — each is an L-shaped pair of lines at the inner rect corners */}
        {/* Top-left */}
        <path d={`M${ip} ${ip + 9} L${ip} ${ip} L${ip + 9} ${ip}`} stroke="#c8a84b" strokeWidth="1.6" fill="none" strokeLinecap="square" />
        {/* Top-right */}
        <path d={`M${W - ip - 9} ${ip} L${W - ip} ${ip} L${W - ip} ${ip + 9}`} stroke="#c8a84b" strokeWidth="1.6" fill="none" strokeLinecap="square" />
        {/* Bottom-left */}
        <path d={`M${ip} ${H - ip - 9} L${ip} ${H - ip} L${ip + 9} ${H - ip}`} stroke="#c8a84b" strokeWidth="1.6" fill="none" strokeLinecap="square" />
        {/* Bottom-right */}
        <path d={`M${W - ip - 9} ${H - ip} L${W - ip} ${H - ip} L${W - ip} ${H - ip - 9}`} stroke="#c8a84b" strokeWidth="1.6" fill="none" strokeLinecap="square" />

        {/* Left side diamond ornament */}
        <path d={`M${ip + 18} ${H / 2} L${ip + 24} ${H / 2 - 5} L${ip + 30} ${H / 2} L${ip + 24} ${H / 2 + 5}Z`}
          fill="#c8a84b" opacity="0.72" />
        {/* Right side diamond ornament */}
        <path d={`M${W - ip - 18} ${H / 2} L${W - ip - 24} ${H / 2 - 5} L${W - ip - 30} ${H / 2} L${W - ip - 24} ${H / 2 + 5}Z`}
          fill="#c8a84b" opacity="0.72" />

        {/* Top-center small dot on outer border */}
        <circle cx={W / 2} cy={op} r="2.2" fill="#c8a84b" />
        <circle cx={W / 2} cy={ip} r="1.2" fill="#c8a84b" opacity="0.6" />
        {/* Bottom-center small dot on outer border */}
        <circle cx={W / 2} cy={H - op} r="2.2" fill="#c8a84b" />
        <circle cx={W / 2} cy={H - ip} r="1.2" fill="#c8a84b" opacity="0.6" />

        {/* Surah name centered */}
        <text
          x={W / 2} y={H / 2 + 1}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="'Amiri Quran','Scheherazade New',serif"
          fontSize="16" fontWeight="700" fill="#010101"
          letterSpacing="0.04em"
        >
          سورة {name}
        </text>
      </svg>
    </div>
  );
}

/* Bismillah — shown for all surahs except 1 and 9 */
function BismillahHeader() {
  return (
    <div style={{
      display: 'block', width: '100%', textAlign: 'center',
      margin: '4px 0 8px',
      fontFamily: "'Amiri Quran','Scheherazade New','Traditional Arabic',serif",
      fontSize: 20, color: '#010101', lineHeight: 1.8,
      letterSpacing: '0.02em',
    }}>
      {BISMILLAH}
    </div>
  );
}

/* ── Types ───────────────────────────────────────────────────────────── */

interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  onVerseClick?: (chapter: number, verse: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  autoFollow?: boolean;
}

const EMPTY_META = { juz: null, hizb: null, surahs: [] };

/* ── Main component ──────────────────────────────────────────────────── */

export default function MushafQCFPage({ page, currentChapter, currentVerse, onVerseClick, onAyahTap, autoFollow }: Props) {
  /* Check module-level cache first — no loading spinner if data is already there */
  const cached = getCachedPage(page);
  const [data, setData] = useState<PageData | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);

  const hlRef = useRef<HTMLSpanElement | null>(null);
  let hlRefAttached = false;

  const qFont = "'Amiri Quran','Scheherazade New','Traditional Arabic',serif";

  useEffect(() => {
    const hit = getCachedPage(page);
    if (hit) {
      setData(hit);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchAndCachePage(page).then(d => {
      if (cancelled) return;
      if (d) { setData(d); setLoading(false); }
      else { setError(true); setLoading(false); }
    });
    return () => { cancelled = true; };
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

  const meta = data?.meta ?? EMPTY_META;

  const surahLabel = useMemo(
    () => meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و'),
    [meta.surahs],
  );

  /* Prefetch pages adjacent to adjacent (so N+2 is ready when user swipes to N+1) */
  useEffect(() => {
    prefetchPage(page - 1);
    prefetchPage(page + 1);
    prefetchPage(page + 2);
  }, [page]);

  return (
    <div style={{
      background: '#F8EBD5', minHeight: '100%', width: '100%',
      display: 'flex', flexDirection: 'column',
      userSelect: 'none', WebkitUserSelect: 'none',
    }}>

      {/* ── Page header: Juz name ── icon ── Surah name ── */}
      <div style={{ paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
        <GoldLine />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 18px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#72603F', fontFamily: qFont }}>
            {meta.juz ? juzName(meta.juz) : ''}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4V4z" fill="#c8a84b" opacity=".85"/>
            <path d="M20 4h-6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6V4z" fill="#c8a84b" opacity=".5"/>
            <line x1="12" y1="6" x2="12" y2="18" stroke="#fff" strokeWidth=".8"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#72603F', fontFamily: qFont }}>
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
            color: '#010101',
            overflowX: 'hidden',
          }}
        >
          {(() => {
            const elements: React.ReactNode[] = [];
            let prevChapterId = -1;

            allWords.forEach((word, i) => {
              const isEnd = word.charType === 'end';
              const isHl = !isEnd
                && word.chapterId === currentChapter
                && word.verseNumber === currentVerse;

              /* Insert Surah header + Bismillah when a new surah begins */
              if (word.chapterId !== prevChapterId && word.verseNumber === 1) {
                elements.push(
                  <SurahHeader key={`sh-${word.chapterId}`} chapterId={word.chapterId} />,
                );
                if (!NO_BISMILLAH.has(word.chapterId)) {
                  elements.push(<BismillahHeader key={`bm-${word.chapterId}`} />);
                }
              }
              prevChapterId = word.chapterId;

              /* Attach scroll ref to first highlighted word */
              const attachRef = isHl && !hlRefAttached;
              if (attachRef) hlRefAttached = true;

              /*
               * End-of-ayah marker: QF API text_uthmani for char_type "end" is the
               * verse number in Eastern Arabic. Prepend U+06DD (Arabic End of Ayah)
               * so Amiri Quran renders the traditional ornamental enclosing circle.
               */
              const displayText = isEnd
                ? (word.text.startsWith(AYAH_MARK) ? word.text : `${AYAH_MARK}${word.text}`)
                : word.text;

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
                    fontSize: isEnd ? 17 : 19,
                    color: isEnd ? '#c8a84b' : '#010101',
                    background: isHl ? '#EFE2CD' : 'transparent',
                    borderRadius: isHl ? 5 : 0,
                    padding: isHl ? '2px 4px' : undefined,
                    cursor: isEnd ? 'default' : 'pointer',
                    transition: 'background .2s',
                    WebkitTouchCallout: 'none',
                  }}
                >
                  {displayText}{' '}
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
          <span style={{ fontSize: 11, color: '#72603F', fontFamily: qFont, fontWeight: 600 }}>
            {meta.hizb ? `الحزب ${toEastern(meta.hizb)}` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'rgba(200,168,75,.7)' }}>◆</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#010101', fontFamily: qFont }}>
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
