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

/* ── Triple-rule separator ─────────────────────────────────────────── */
function MushafBorderRule() {
  return (
    <div style={{ padding: '0 10px' }}>
      <div style={{ height: 2, background: RULE_COLOR, borderRadius: 1 }} />
      <div style={{ height: 2 }} />
      <div style={{ height: 0.75, background: RULE_COLOR, opacity: 0.55 }} />
      <div style={{ height: 2 }} />
      <div style={{ height: 1.5, background: RULE_COLOR, borderRadius: 0.5 }} />
    </div>
  );
}

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

/* ── Open-book ornament for top metadata centre ───────────────────── */
function MushafBookMark() {
  return (
    <svg width="20" height="15" viewBox="0 0 20 15" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M10 1.5 C8 1.5 3.5 2.5 3.5 4 L3.5 13 C3.5 13 7 12 10 13 L10 1.5 Z"
        fill="#f4e9ca" stroke="#b89840" strokeWidth="0.7" strokeLinejoin="round"/>
      <path d="M10 1.5 C12 1.5 16.5 2.5 16.5 4 L16.5 13 C16.5 13 13 12 10 13 L10 1.5 Z"
        fill="#f4e9ca" stroke="#b89840" strokeWidth="0.7" strokeLinejoin="round"/>
      <line x1="10" y1="1.5" x2="10" y2="13" stroke="#b89840" strokeWidth="1"/>
      <line x1="5.5" y1="5" x2="8.5" y2="5" stroke="#b89840" strokeWidth="0.35" opacity="0.65"/>
      <line x1="5.5" y1="7" x2="8.5" y2="7" stroke="#b89840" strokeWidth="0.35" opacity="0.65"/>
      <line x1="5.5" y1="9" x2="8.5" y2="9" stroke="#b89840" strokeWidth="0.35" opacity="0.65"/>
      <line x1="11.5" y1="5" x2="14.5" y2="5" stroke="#b89840" strokeWidth="0.35" opacity="0.65"/>
      <line x1="11.5" y1="7" x2="14.5" y2="7" stroke="#b89840" strokeWidth="0.35" opacity="0.65"/>
      <line x1="11.5" y1="9" x2="14.5" y2="9" stroke="#b89840" strokeWidth="0.35" opacity="0.65"/>
    </svg>
  );
}

/* ── Top metadata ─────────────────────────────────────────────────── */
function MushafTopMetadata({ meta, surahLabel }: { meta: PageData['meta']; surahLabel: string }) {
  return (
    <div dir="rtl" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 16px',
      background: 'rgba(107, 80, 15, 0.035)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: RULE_COLOR, fontFamily: META_FONT, letterSpacing: '0.01em' }}>
        {meta.juz ? juzLabel(meta.juz) : ''}
      </span>
      <MushafBookMark />
      <span style={{ fontSize: 12, fontWeight: 700, color: RULE_COLOR, fontFamily: META_FONT, letterSpacing: '0.01em' }}>
        {surahLabel}
      </span>
    </div>
  );
}

/* ── Footer ───────────────────────────────────────────────────────── */
function MushafFooter({ meta, page }: { meta: PageData['meta']; page: number }) {
  return (
    <div style={{ paddingTop: 4, paddingBottom: 8, flexShrink: 0 }}>
      <MushafBorderRule />
      <div dir="rtl" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 16px',
      }}>
        <span style={{ fontSize: 12, color: RULE_COLOR, fontFamily: META_FONT, fontWeight: 600 }}>
          {meta.hizb ? `الحزب ${toEastern(meta.hizb)}` : ''}
        </span>
        <svg viewBox="0 0 52 22" style={{ width: 52, height: 22 }}>
          <rect x="1" y="1" width="50" height="20" rx="2" fill="rgba(107,80,15,0.08)" stroke={RULE_COLOR} strokeWidth="1" />
          <line x1="5" y1="5" x2="47" y2="5" stroke={RULE_COLOR} strokeWidth="0.4" opacity="0.5" />
          <line x1="5" y1="17" x2="47" y2="17" stroke={RULE_COLOR} strokeWidth="0.4" opacity="0.5" />
          <text x="26" y="13" textAnchor="middle" dominantBaseline="middle"
            fontFamily={META_FONT} fontSize="11" fontWeight="bold" fill="#0a0500">
            {toEastern(page)}
          </text>
        </svg>
        <span style={{ fontSize: 12, color: 'transparent' }}>0</span>
      </div>
      <MushafBorderRule />
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
    warmQCFFont(page).then(() => setQcfReady(true)).catch(() => {});
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

  /*
   * Determine the maximum line number on this page so the grid knows
   * how many rows to allocate. Standard pages have 15 lines; page 1
   * and 2 have fewer.
   */
  const maxLineNum = useMemo(
    () => data ? Math.max(...data.lines.map(l => l.lineNum), 1) : 15,
    [data],
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

      {/* ── Physical page top metadata ── */}
      <div style={{ paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
        <MushafBorderRule />
        <MushafTopMetadata meta={meta} surahLabel={surahLabel} />
        <MushafBorderRule />
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
          ...(opening
            ? {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'center',
                padding: '8px 0',
              }
            : {
                display: 'grid',
                gridTemplateRows: `repeat(${maxLineNum}, 1fr)`,
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
                  lineHeight: 2.4,
                  padding: '0 16px',
                }
              : {
                  gridRow: lineNum,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  direction: 'rtl',
                  overflow: 'hidden',
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
                        fontSize: isEnd ? (opening ? 17 : 14) : (opening ? 19 : 16),
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
