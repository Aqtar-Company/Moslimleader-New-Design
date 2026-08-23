'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  getCachedPage, fetchAndCachePage, prepareMushafPage,
  isFontLoaded, warmQCFFont,
} from './mushafCache';
import type { PageData, MushafWord } from './mushafCache';

/* ── Surah names (metadata header only) ────────────────────────────── */
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
const QCF_CDN = 'https://fonts.qurancdn.com';

// Pages 1 and 2 are opening pages — special vertically-centered composition.
// All other pages (3–604) use the fixed top-aligned 15-line physical grid.
function isOpeningPage(page: number) { return page === 1 || page === 2; }

function pad3(n: number) { return String(n).padStart(3, '0'); }
function toEastern(n: number) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]); }
function juzLabel(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `جزء ${n}`; }
function qcfFamilyName(page: number) { return `p${page}-v2`; }

const META_FONT = "'Amiri Quran','Scheherazade New','Traditional Arabic',serif";
const RULE_COLOR = '#6B500F';

/* ── surahnames @font-face only (QCF fonts loaded via FontFace API in mushafCache) ── */
function SurahNamesFontStyle() {
  return (
    <style dangerouslySetInnerHTML={{
      __html: `@font-face{font-family:'surahnames';src:url('/fonts/sura_names.woff2')format('woff2');font-display:block}`,
    }} />
  );
}

/* ── Thin single hairline separator (used only internally, not top/bottom) ── */
// Kept for potential internal use; top/bottom metadata no longer use heavy borders.

/* ── Surah header — SVG frame + surahnames icon font ──────────────── */
function SurahHeader({ chapterId }: { chapterId: number }) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/surah_header_mushaf.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          style={{ fontFamily: "'surahnames', serif", fontSize: 36, color: '#0a0500', lineHeight: 1 }}
          translate="no"
        >
          {String(chapterId).padStart(3, '0')}
        </span>
      </div>
    </div>
  );
}

/* ── Bismillah — authentic SVG ────────────────────────────────────── */
function BismillahLine() {
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bismillah.svg"
        alt="بسم الله الرحمن الرحيم"
        draggable={false}
        style={{ width: 220, height: 'auto', display: 'block', color: '#0a0500' }}
      />
    </div>
  );
}

/*
 * Small open-book symbol for the center of the top metadata row.
 * Matches the visual weight of the printed Madinah Mushaf center ornament —
 * understated, not decorative clutter.
 */
function MushafBookMark() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}>
      {/* Left page */}
      <path d="M9 1.2 C7.2 1.2 3 2 3 3.4 L3 12 C6 11.1 8 11.5 9 12 L9 1.2 Z"
        fill="none" stroke="#4a3a1a" strokeWidth="0.8" strokeLinejoin="round"/>
      {/* Right page */}
      <path d="M9 1.2 C10.8 1.2 15 2 15 3.4 L15 12 C12 11.1 10 11.5 9 12 L9 1.2 Z"
        fill="none" stroke="#4a3a1a" strokeWidth="0.8" strokeLinejoin="round"/>
      {/* Spine */}
      <line x1="9" y1="1.2" x2="9" y2="12" stroke="#4a3a1a" strokeWidth="0.9"/>
      {/* Text lines — left page */}
      <line x1="4.5" y1="4.5" x2="7.5" y2="4.5" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      <line x1="4.5" y1="6.2" x2="7.5" y2="6.2" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      <line x1="4.5" y1="7.9" x2="7.5" y2="7.9" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      {/* Text lines — right page */}
      <line x1="10.5" y1="4.5" x2="13.5" y2="4.5" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      <line x1="10.5" y1="6.2" x2="13.5" y2="6.2" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
      <line x1="10.5" y1="7.9" x2="13.5" y2="7.9" stroke="#4a3a1a" strokeWidth="0.45" opacity="0.6"/>
    </svg>
  );
}

/*
 * Top metadata row — matches the printed Madinah Mushaf header exactly:
 *
 *   RTL visual layout:
 *   RIGHT: Juz label          CENTER: book ornament          LEFT: Surah label(s)
 *   "الجزء السادس والعشرون"       📖                      "الجاثية والأحقاف"
 *
 * No borders. No background. No boxes. Only restrained dark typography
 * with generous breathing room, as in the printed Mushaf.
 */
function MushafTopMetadata({ meta, surahLabel }: { meta: PageData['meta']; surahLabel: string }) {
  return (
    <div dir="rtl" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 18px 8px',
    }}>
      {/* Visual RIGHT (DOM first in RTL): Juz */}
      <span style={{
        fontSize: 12.5, fontWeight: 600, color: '#0a0500',
        fontFamily: META_FONT, letterSpacing: '0.01em', lineHeight: 1.4,
      }}>
        {meta.juz ? juzLabel(meta.juz) : ''}
      </span>
      {/* CENTER: book ornament */}
      <MushafBookMark />
      {/* Visual LEFT (DOM last in RTL): Surah name(s) */}
      <span style={{
        fontSize: 12.5, fontWeight: 600, color: '#0a0500',
        fontFamily: META_FONT, letterSpacing: '0.01em', lineHeight: 1.4,
      }}>
        {surahLabel}
      </span>
    </div>
  );
}

/*
 * Ornamental rosette flanking the page number — a small 8-petal motif
 * matching the teal decorative elements in the printed Madinah Mushaf footer.
 * Color: #2A7A6E (teal).
 */
function FooterRosette() {
  const C = '#2A7A6E';
  // 8 petals: pairs of ellipses at 0/90/45/135 degrees, all passing through center
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <ellipse cx="5.5" cy="5.5" rx="2.2" ry="4.5" fill={C} opacity="0.85"/>
      <ellipse cx="5.5" cy="5.5" rx="4.5" ry="2.2" fill={C} opacity="0.85"/>
      <ellipse cx="5.5" cy="5.5" rx="2.2" ry="4.5" transform="rotate(45 5.5 5.5)" fill={C} opacity="0.85"/>
      <ellipse cx="5.5" cy="5.5" rx="2.2" ry="4.5" transform="rotate(-45 5.5 5.5)" fill={C} opacity="0.85"/>
      {/* Center circle — white cutout creates the open-centre rosette look */}
      <circle cx="5.5" cy="5.5" r="1.6" fill="#F8EBD5"/>
    </svg>
  );
}

/*
 * Physical Mushaf footer — matches the printed Madinah Mushaf:
 *
 *   RTL visual layout:
 *   RIGHT: Hizb label    CENTER: ornamental page number    LEFT: (empty)
 *   "الحزب 51"                ❁ 502 ❁
 *
 * Western numerals match the reference. No heavy divider above — whitespace only.
 */
function MushafFooter({ meta, page }: { meta: PageData['meta']; page: number }) {
  const TEAL = '#2A7A6E';
  return (
    <div dir="rtl" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 18px 10px',
      flexShrink: 0,
    }}>
      {/* Visual RIGHT (DOM first in RTL): Hizb — Western numeral matches reference */}
      <span style={{
        fontSize: 12, color: '#0a0500', fontFamily: META_FONT, fontWeight: 500,
        minWidth: 60,
      }}>
        {meta.hizb ? `الحزب ${meta.hizb}` : ''}
      </span>

      {/* CENTER: ornamental teal page-number frame */}
      <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <FooterRosette />
        <div style={{
          minWidth: 36, height: 20,
          border: `1.5px solid ${TEAL}`,
          borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 7px',
          background: `rgba(42,122,110,0.06)`,
        }}>
          <span style={{
            fontSize: 11.5, fontWeight: 700, color: '#1a5a50',
            fontFamily: META_FONT, lineHeight: 1,
          }}>
            {page}
          </span>
        </div>
        <FooterRosette />
      </div>

      {/* Visual LEFT (DOM last in RTL): empty — balances the row */}
      <span style={{ minWidth: 60 }} />
    </div>
  );
}

/* ── Props ─────────────────────────────────────────────────────────── */
interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  isPlaying?: boolean;
  onVerseClick?: (chapter: number, verse: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  autoFollow?: boolean;
}

/* ── Main component ─────────────────────────────────────────────────── */
export default function MushafQCFPage({
  page, currentChapter, currentVerse, isPlaying,
  onVerseClick, onAyahTap, autoFollow,
}: Props) {
  const opening = isOpeningPage(page);

  const [localData, setLocalData] = useState<PageData | null>(null);
  const data: PageData | null = getCachedPage(page) ?? localData;
  const dataLoading = !data;

  /*
   * QCF font readiness — initialised from the global font cache so that
   * when the carousel re-assigns a page prop, component instances that
   * already loaded the font for this page skip the flash entirely.
   * isFontLoaded() is a module-level Set: once set, any React instance
   * reading it sees the cached value immediately.
   */
  const qcfFamily = qcfFamilyName(page);
  const qcfFont = `'${qcfFamily}', sans-serif`;
  const [qcfReady, setQcfReady] = useState(() => isFontLoaded(qcfFamily));

  const hlRef = useRef<HTMLSpanElement | null>(null);
  let hlRefAttached = false;

  /* Data fetch — cache hit is synchronous, no loading state for cached pages */
  useEffect(() => {
    setLocalData(null);
    if (getCachedPage(page)) return;
    let cancelled = false;
    console.log('[MushafQCFPage] LOADING reason: PAGE_DATA_MISSING page=', page);
    fetchAndCachePage(page).then(d => { if (!cancelled && d) setLocalData(d); });
    return () => { cancelled = true; };
  }, [page]);

  /* Prepare adjacent pages (data + font) so next swipe is loader-free */
  useEffect(() => {
    prepareMushafPage(page - 2);
    prepareMushafPage(page - 1);
    prepareMushafPage(page + 1);
    prepareMushafPage(page + 2);
  }, [page]);

  /*
   * QCF font loading — global cache check first.
   * If the font was already loaded (by any other MushafQCFPage for this page),
   * immediately set ready=true without going through false → avoids flash.
   */
  useEffect(() => {
    const family = qcfFamilyName(page);
    if (isFontLoaded(family)) {
      setQcfReady(true);
      return;
    }
    // Font not yet in global cache — show fallback until it loads
    setQcfReady(false);
    console.log('[MushafQCFPage] LOADING reason: QCF_FONT_NOT_READY page=', page, 'family=', family);
    /*
     * warmQCFFont resolves regardless of success or failure (catch swallows
     * the error to avoid blocking swipe). After it resolves, check the global
     * font cache to know whether the font actually loaded — only then flip
     * qcfReady. Without this guard, a CORS/404 failure causes garbled QCF
     * glyph codes to render in a generic Arabic fallback font.
     */
    warmQCFFont(page).then(() => {
      if (isFontLoaded(family)) {
        setQcfReady(true);
      } else {
        console.log('[MushafQCFPage] QCF font failed to load, keeping fallback text — page=', page);
      }
    }).catch(() => {});
  }, [page]);

  /* Auto-scroll highlighted verse into view */
  useEffect(() => {
    if (autoFollow && hlRef.current) {
      hlRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter, currentVerse, autoFollow]);

  type RenderItem =
    | { type: 'surah_header'; chapterId: number; gridRow: number }
    | { type: 'bismillah'; key: string; gridRow: number }
    | { type: 'line'; lineNum: number; words: MushafWord[] };

  const renderItems = useMemo<RenderItem[]>(() => {
    if (!data) return [];
    const sorted = [...data.lines].sort((a, b) => a.lineNum - b.lineNum);
    const result: RenderItem[] = [];
    let prevCh = -1;
    for (const line of sorted) {
      const fw = line.words[0];
      if (fw && fw.chapterId !== prevCh && fw.verseNumber === 1) {
        // Surah header occupies the grid row(s) immediately before this line.
        // If no bismillah: header = lineNum - 1. If bismillah: header = lineNum - 2.
        const hasBism = !NO_BISMILLAH.has(fw.chapterId);
        const headerRow = Math.max(1, line.lineNum - (hasBism ? 2 : 1));
        result.push({ type: 'surah_header', chapterId: fw.chapterId, gridRow: headerRow });
        if (hasBism) {
          result.push({ type: 'bismillah', key: `bm-${fw.chapterId}`, gridRow: headerRow + 1 });
        }
        prevCh = fw.chapterId;
      } else if (fw) {
        prevCh = fw.chapterId;
      }
      result.push({ type: 'line', lineNum: line.lineNum, words: line.words });
    }
    return result;
  }, [data]);

  const meta = data?.meta ?? { juz: null, hizb: null, surahs: [] };
  const surahLabel = useMemo(
    () => meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و'),
    [meta.surahs],
  );

  return (
    <div style={{
      background: '#F8EBD5',
      /*
       * height:100% fills the absolute-positioned carousel slot exactly.
       * This is the physical page canvas — nothing inside should extend
       * beyond it (overflow:hidden on the text area enforces this).
       */
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    }}>
      <SurahNamesFontStyle />

      {/* ── Physical page top metadata — no borders, whitespace only ── */}
      <div style={{ flexShrink: 0 }}>
        <MushafTopMetadata meta={meta} surahLabel={surahLabel} />
      </div>

      {/* ── Page body ── */}
      {dataLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`@keyframes ms-spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '2px solid rgba(184,152,64,.2)', borderTopColor: '#b89840',
            animation: 'ms-spin .7s linear infinite',
          }} />
        </div>
      ) : (
        /*
         * MushafTextArea — the physical text canvas between header and footer.
         *
         * OPENING PAGES (1, 2): few lines → content is vertically centred.
         * NORMAL PAGES (3–604): content top-aligned in a CSS Grid with one row
         *   per physical Mushaf line. Each grid row = equal fraction of the
         *   available text area height. Lines are placed at grid-row: lineNum
         *   so their visual position is fixed regardless of surrounding content.
         *   overflow:hidden ensures the page never overflows its slot.
         */
        <div style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          /*
           * Horizontal margins — 10px each side mirrors the printed Mushaf's
           * inner margins and keeps text off the screen edge. The grid rows
           * still fill the full height; only horizontal space is constrained.
           */
          padding: opening ? '8px 14px' : '0 10px',
          ...(opening
            ? {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'center',
              }
            : {
                display: 'grid',
                gridTemplateRows: 'repeat(15, 1fr)',
              }
          ),
        }}>
          {renderItems.map((item) => {
            if (item.type === 'surah_header') {
              return (
                <div
                  key={`sh-${item.chapterId}`}
                  style={opening ? {} : { gridRow: item.gridRow, alignSelf: 'center' }}
                >
                  <SurahHeader chapterId={item.chapterId} />
                </div>
              );
            }

            if (item.type === 'bismillah') {
              return (
                <div
                  key={item.key}
                  style={opening
                    ? { display: 'flex', alignItems: 'center', justifyContent: 'center' }
                    : { gridRow: item.gridRow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <BismillahLine />
                </div>
              );
            }

            /*
             * Physical Mushaf line.
             *
             * Normal pages: grid-row maps the physical line_number to its fixed
             * visual slot. The QCF V2 glyph widths are pre-calibrated so words
             * at the correct font size fill the line width; text-align:center
             * handles any minor remainder.
             *
             * Font size 16px (down from 19px) ensures 15 lines fit the grid
             * on mid-size phones (375–414px wide). Opening pages keep 19px
             * since they have far fewer lines.
             */
            const { lineNum, words } = item;
            const lineStyle: React.CSSProperties = opening
              ? {
                  display: 'block',
                  direction: 'rtl',
                  textAlign: 'center',
                  lineHeight: 2.2,
                }
              : {
                  gridRow: lineNum,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  direction: 'rtl',
                  /*
                   * 3px vertical padding inside each grid cell so upper diacritics
                   * (shadda, sukun stacked above letters) and lower marks are not
                   * clipped by the cell boundary. overflow:visible allows them to
                   * breathe slightly into the adjacent row's spacing — the 1fr rows
                   * have enough gap to absorb this without visual collision.
                   */
                  paddingBlock: '3px',
                  overflow: 'visible',
                };

            return (
              <div key={lineNum} dir="rtl" style={lineStyle}>
                {words.map((word, wi) => {
                  const isEnd = word.charType === 'end';
                  const isHl = isPlaying === true
                    && !isEnd
                    && word.chapterId === currentChapter
                    && word.verseNumber === currentVerse;
                  const attachRef = isHl && !hlRefAttached;
                  if (attachRef) hlRefAttached = true;

                  const txt = qcfReady
                    ? (word.codeV2 || word.text)
                    : isEnd
                      ? (word.text.startsWith('۝') ? word.text : `۝${word.text}`)
                      : word.text + ' ';

                  return (
                    <span
                      key={wi}
                      ref={attachRef ? hlRef : undefined}
                      onClick={() => {
                        if (isEnd) return;
                        onAyahTap?.({ chapterId: word.chapterId, verseNumber: word.verseNumber, text: word.text });
                        onVerseClick?.(word.chapterId, word.verseNumber);
                      }}
                      style={{
                        display: 'inline-block',
                        fontFamily: qcfReady ? qcfFont : META_FONT,
                        fontSize: isEnd ? (opening ? 17 : 14) : (opening ? 20 : 17),
                        color: isEnd ? '#b89840' : '#010101',
                        background: isHl ? 'rgba(190,160,80,0.22)' : 'transparent',
                        borderRadius: isHl ? 4 : 0,
                        padding: isHl ? '1px 3px' : undefined,
                        cursor: isEnd ? 'default' : 'pointer',
                        transition: 'background .15s',
                        WebkitTouchCallout: 'none',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'baseline',
                      }}
                    >
                      {txt}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Physical page footer ── */}
      <MushafFooter meta={meta} page={page} />
    </div>
  );
}
