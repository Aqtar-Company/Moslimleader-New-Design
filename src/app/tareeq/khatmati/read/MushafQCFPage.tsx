'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { getCachedPage, fetchAndCachePage, prepareMushafPage, getPageJuz, getPageHizb } from './mushafCache';
import type { PageData, MushafLine } from './mushafCache';

// ── Surah names ────────────────────────────────────────────────────────
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

const QURAN_FONT = "'Amiri Quran','Scheherazade New','Traditional Arabic',serif";
const NO_BISMILLAH = new Set([1, 9]);

function isOpeningPage(page: number) { return page === 1 || page === 2; }
function juzLabel(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `جزء ${n}`; }

// ── Surah header ────────────────────────────────────────────────────────
function SurahHeader({ surahNum }: { surahNum: number }) {
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    const face = document.fonts && [...document.fonts].find(f => f.family === 'surahnames');
    if (face && face.status === 'loaded') { setFontReady(true); return; }
    const ff = new FontFace('surahnames', "url('/fonts/sura_names.woff2') format('woff2')");
    document.fonts.add(ff);
    ff.load().then(() => setFontReady(true)).catch(() => {});
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/surah_header_mushaf.svg" alt="" aria-hidden="true" draggable={false}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {fontReady ? (
          <span style={{ fontFamily: "'surahnames',serif", fontSize: 36, color: '#0a0500', lineHeight: 1 }} translate="no">
            {String(surahNum).padStart(3, '0')}
          </span>
        ) : (
          <span style={{ fontFamily: QURAN_FONT, fontSize: 18, fontWeight: 700, color: '#0a0500', lineHeight: 1 }}>
            {SURAH_AR[surahNum] ?? ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Bismillah ───────────────────────────────────────────────────────────
function BismillahLine() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBlock: '4px' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bismillah.svg" alt="بسم الله الرحمن الرحيم" draggable={false}
        style={{ width: 220, height: 'auto', display: 'block' }}
      />
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
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0a0500', fontFamily: QURAN_FONT, lineHeight: 1.4 }}>
        {juz ? juzLabel(juz) : ''}
      </span>
      <MushafBookMark />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0a0500', fontFamily: QURAN_FONT, lineHeight: 1.4 }}>
        {surahLabel}
      </span>
    </div>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────
function FooterRosette() {
  const C = '#2A7A6E';
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <ellipse cx="5.5" cy="5.5" rx="2.2" ry="4.5" fill={C} opacity="0.85"/>
      <ellipse cx="5.5" cy="5.5" rx="4.5" ry="2.2" fill={C} opacity="0.85"/>
      <ellipse cx="5.5" cy="5.5" rx="2.2" ry="4.5" transform="rotate(45 5.5 5.5)" fill={C} opacity="0.85"/>
      <ellipse cx="5.5" cy="5.5" rx="2.2" ry="4.5" transform="rotate(-45 5.5 5.5)" fill={C} opacity="0.85"/>
      <circle cx="5.5" cy="5.5" r="1.6" fill="#F8EBD5"/>
    </svg>
  );
}

function MushafFooter({ hizb, page }: { hizb: number; page: number }) {
  const TEAL = '#2A7A6E';
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px 10px', flexShrink: 0 }}>
      <span style={{ fontSize: 12, color: '#0a0500', fontFamily: QURAN_FONT, fontWeight: 500, minWidth: 60 }}>
        {hizb ? `الحزب ${hizb}` : ''}
      </span>
      <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <FooterRosette />
        <div style={{ minWidth: 36, height: 20, border: `1.5px solid ${TEAL}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 7px', background: `rgba(42,122,110,0.06)` }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1a5a50', fontFamily: QURAN_FONT, lineHeight: 1 }}>{page}</span>
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

  const [localData, setLocalData] = useState<PageData | null>(null);
  const data: PageData | null = getCachedPage(page) ?? localData;

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

  // Auto-scroll highlighted verse
  useEffect(() => {
    if (autoFollow && hlRef.current) {
      hlRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter, currentVerse, autoFollow]);

  // Derive surah list from page lines for header
  const surahsOnPage = useMemo<number[]>(() => {
    if (!data) return [];
    const seen = new Set<number>();
    for (const line of data.lines) {
      if (line.type === 'surah-header' && line.surah) {
        seen.add(parseInt(line.surah, 10));
      }
      if (line.type === 'text' && line.words) {
        for (const w of line.words) {
          if (w.surah) seen.add(w.surah);
        }
      }
    }
    return [...seen];
  }, [data]);

  const surahLabel = surahsOnPage.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و');
  const juz = getPageJuz(page);
  const hizb = getPageHizb(page);

  if (!data) {
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

      {/* Page body */}
      <div style={opening ? {
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'stretch', justifyContent: 'center',
        padding: '0 18px', overflow: 'hidden',
      } : {
        padding: '4px 12px 8px',
        maxWidth: '500px',
        margin: '0 auto',
        width: '100%',
      }}>
        {data.lines.map(line => renderLine(line))}
      </div>

      <div style={{ flexShrink: 0 }}>
        <MushafFooter hizb={hizb} page={page} />
      </div>
    </div>
  );

  function renderLine(line: MushafLine) {
    if (line.type === 'surah-header') {
      const num = line.surah ? parseInt(line.surah, 10) : 0;
      return (
        <div key={`sh-${line.line}`} style={{ width: '100%' }}>
          <SurahHeader surahNum={num} />
        </div>
      );
    }

    if (line.type === 'basmala') {
      return <BismillahLine key={`bm-${line.line}`} />;
    }

    // type === 'text'
    const words = line.words ?? [];
    /*
     * Render as flowing inline Arabic text so the browser's shaping engine
     * treats the whole line as one text run and can apply kashida via
     * text-justify:auto. Requires display:inline on spans (not inline-block).
     */
    const justify = !opening && words.length >= 3;

    return (
      <div
        key={line.line}
        dir="rtl"
        style={{
          display: 'block',
          direction: 'rtl',
          textAlign: justify ? 'justify' : 'center',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          textAlignLast: (justify ? 'justify' : 'center') as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          textJustify: 'auto' as any,
          fontFamily: QURAN_FONT,
          fontSize: opening ? 20 : 'clamp(17px, 5.2vw, 23px)',
          lineHeight: opening ? 2.4 : 2.2,
          paddingBlock: opening ? '2px' : '5px',
          width: '100%',
        }}
      >
        {words.map((word, wi) => {
          const isHl = isPlaying === true
            && word.surah === currentChapter
            && word.verse === currentVerse;
          const attachRef = isHl && !hlRefAttached;
          if (attachRef) hlRefAttached = true;

          return (
            <span
              key={wi}
              ref={attachRef ? hlRef : undefined}
              onClick={() => {
                onAyahTap?.({ chapterId: word.surah, verseNumber: word.verse, text: word.word });
                onVerseClick?.(word.surah, word.verse);
              }}
              style={{
                display: 'inline',
                color: '#010101',
                background: isHl ? 'rgba(190,160,80,0.25)' : 'transparent',
                borderRadius: isHl ? 4 : 0,
                padding: isHl ? '1px 3px' : undefined,
                cursor: 'pointer',
                transition: 'background .15s',
                WebkitTouchCallout: 'none',
              }}
            >
              {word.word}{' '}
            </span>
          );
        })}
      </div>
    );
  }
}
