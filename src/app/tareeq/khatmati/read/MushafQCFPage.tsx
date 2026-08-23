'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { getCachedPage, fetchAndCachePage, prefetchPage } from './mushafCache';
import type { PageData, MushafWord } from './mushafCache';

/* ── Surah names ───────────────────────────────────────────────── */
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

const SURAH_VERSE_COUNT: Record<number, number> = {
  1:7,2:286,3:200,4:176,5:120,6:165,7:206,8:75,9:129,10:109,
  11:123,12:111,13:43,14:52,15:99,16:128,17:111,18:110,19:98,20:135,
  21:112,22:78,23:118,24:64,25:77,26:227,27:93,28:88,29:69,30:60,
  31:34,32:30,33:73,34:54,35:45,36:83,37:182,38:88,39:75,40:85,
  41:54,42:53,43:89,44:59,45:37,46:35,47:38,48:29,49:18,50:45,
  51:60,52:49,53:62,54:55,55:78,56:96,57:29,58:22,59:24,60:13,
  61:14,62:11,63:11,64:18,65:12,66:12,67:30,68:52,69:52,70:44,
  71:28,72:28,73:20,74:56,75:40,76:31,77:50,78:40,79:46,80:42,
  81:29,82:19,83:36,84:25,85:22,86:17,87:19,88:26,89:30,90:20,
  91:15,92:21,93:11,94:8,95:8,96:19,97:5,98:8,99:8,100:11,
  101:11,102:8,103:3,104:9,105:5,106:4,107:7,108:3,109:6,110:3,
  111:5,112:4,113:5,114:6,
};

/* Madani surahs — all others are Makki */
const SURAH_MADANI = new Set([
  2,3,4,5,8,9,13,22,24,33,47,48,49,57,58,59,60,61,62,63,64,65,66,98,110,
]);

const JUZ_AR = ['','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون','الحادي والعشرون','الثاني والعشرون','الثالث والعشرون','الرابع والعشرون','الخامس والعشرون','السادس والعشرون','السابع والعشرون','الثامن والعشرون','التاسع والعشرون','الثلاثون'];

const NO_BISMILLAH = new Set([1, 9]);
const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
const QCF_CDN = 'https://fonts.qurancdn.com';

function pad3(n: number) { return String(n).padStart(3, '0'); }
function toEastern(n: number) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]); }
function juzLabel(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `جزء ${n}`; }

const META_FONT = "'Amiri Quran','Scheherazade New','Traditional Arabic',serif";

/* ── Inject page-specific QCF font-faces ──────────────────────── */
function QCFFontLoader({ pages }: { pages: number[] }) {
  const unique = [...new Set(pages)].filter(p => p >= 1 && p <= 604);
  const css = unique.map(p => {
    const c = pad3(p);
    return `@font-face{font-family:'QCFv2P${c}';src:url('${QCF_CDN}/QCFv2_P${c}.woff2')format('woff2');font-display:block}`;
  }).join('');
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/* ── Gold rule ─────────────────────────────────────────────────── */
function GoldRule() {
  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{ height: 1.5, background: 'linear-gradient(90deg,transparent,#b89840 10%,#b89840 90%,transparent)' }} />
      <div style={{ height: 0.5, background: 'linear-gradient(90deg,transparent,#b89840 10%,#b89840 90%,transparent)', marginTop: 2 }} />
    </div>
  );
}

/* ── Surah header — real Madinah Mushaf SVG ornament ──────────── */
function SurahHeader({ chapterId }: { chapterId: number }) {
  const name = SURAH_AR[chapterId] ?? '';
  const count = SURAH_VERSE_COUNT[chapterId] ?? 0;
  const type = SURAH_MADANI.has(chapterId) ? 'مدنية' : 'مكية';

  return (
    <div style={{ position: 'relative', width: '100%', margin: '12px 0 4px' }}>
      {/* Actual Madinah Mushaf ornamental frame from public/surah_header_mushaf.svg */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/surah_header_mushaf.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
      />
      {/*
       * Text overlay: the SVG's side panels occupy roughly the outer 17% on each side.
       * We match that with padding so text falls inside the frame's center zone.
       */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        direction: 'rtl', padding: '0 17%',
      }}>
        {/* Right panel: revelation type */}
        <div style={{ textAlign: 'center', minWidth: 60 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#2a1a04', fontFamily: META_FONT }}>{type}</div>
        </div>
        {/* Center: surah name */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{
            fontSize: 17, fontWeight: 700, color: '#0a0500',
            fontFamily: "'Scheherazade New','" + META_FONT + "'",
            letterSpacing: '0.04em',
          }}>
            سورة {name}
          </span>
        </div>
        {/* Left panel: verse count */}
        <div style={{ textAlign: 'center', minWidth: 60 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#2a1a04', fontFamily: META_FONT }}>
            {toEastern(count)} آية
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Bismillah typographic line ────────────────────────────────── */
function BismillahLine() {
  return (
    <div style={{
      textAlign: 'center', width: '100%', margin: '4px 0 6px',
      fontFamily: META_FONT, fontSize: 20, color: '#010101', lineHeight: 1.8,
    }}>
      {BISMILLAH}
    </div>
  );
}

/* ── Top metadata — printed Mushaf style ───────────────────────── */
function MushafTopMetadata({ meta, surahLabel }: { meta: PageData['meta']; surahLabel: string }) {
  return (
    <div dir="rtl" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '3px 16px',
    }}>
      {/* Right: surah range */}
      <span style={{ fontSize: 11, fontWeight: 700, color: '#4a3820', fontFamily: META_FONT }}>
        {surahLabel}
      </span>
      {/* Center: ۞ rub el-hizb — authentic Mushaf quarter-division marker */}
      <span style={{ fontSize: 16, color: '#8a6c35', fontFamily: META_FONT, lineHeight: 1 }}>
        ۞
      </span>
      {/* Left: Juz number */}
      <span style={{ fontSize: 11, fontWeight: 700, color: '#4a3820', fontFamily: META_FONT }}>
        {meta.juz ? juzLabel(meta.juz) : ''}
      </span>
    </div>
  );
}

/* ── Mushaf footer — physical page footer ──────────────────────── */
function MushafFooter({ meta, page }: { meta: PageData['meta']; page: number }) {
  return (
    <div style={{ paddingTop: 4, paddingBottom: 8, flexShrink: 0 }}>
      <GoldRule />
      <div dir="rtl" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 16px',
      }}>
        <span style={{ fontSize: 11, color: '#72603F', fontFamily: META_FONT, fontWeight: 600 }}>
          {meta.hizb ? `الحزب ${toEastern(meta.hizb)}` : ''}
        </span>
        {/* Ornamental page-number frame */}
        <svg viewBox="0 0 52 22" style={{ width: 52, height: 22 }}>
          <rect x="1" y="1" width="50" height="20" rx="2" fill="rgba(185,152,64,0.1)" stroke="#b89840" strokeWidth="0.8" />
          <line x1="5" y1="5" x2="47" y2="5" stroke="#b89840" strokeWidth="0.35" opacity="0.6" />
          <line x1="5" y1="17" x2="47" y2="17" stroke="#b89840" strokeWidth="0.35" opacity="0.6" />
          <text x="26" y="13" textAnchor="middle" dominantBaseline="middle"
            fontFamily={META_FONT} fontSize="11" fontWeight="bold" fill="#010101">
            {toEastern(page)}
          </text>
        </svg>
        {/* spacer */}
        <span style={{ fontSize: 11, color: 'transparent' }}>0</span>
      </div>
      <GoldRule />
    </div>
  );
}

/* ── Props ─────────────────────────────────────────────────────── */
interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  isPlaying?: boolean;
  onVerseClick?: (chapter: number, verse: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  autoFollow?: boolean;
}

/* ── Main component ─────────────────────────────────────────────── */
export default function MushafQCFPage({
  page, currentChapter, currentVerse, isPlaying,
  onVerseClick, onAyahTap, autoFollow,
}: Props) {
  const [localData, setLocalData] = useState<PageData | null>(null);
  const data: PageData | null = getCachedPage(page) ?? localData;
  const loading = !data;

  /* Track whether the page-specific QCF font has loaded */
  const [qcfReady, setQcfReady] = useState(false);
  const qcfFamily = `QCFv2P${pad3(page)}`;
  const qcfFont = `'${qcfFamily}',sans-serif`;

  const hlRef = useRef<HTMLSpanElement | null>(null);
  let hlRefAttached = false;

  /* Fetch page data if not cached */
  useEffect(() => {
    setLocalData(null);
    if (getCachedPage(page)) return;
    let cancelled = false;
    fetchAndCachePage(page).then(d => { if (!cancelled && d) setLocalData(d); });
    return () => { cancelled = true; };
  }, [page]);

  /* Pre-warm ±2 pages */
  useEffect(() => {
    prefetchPage(page - 2);
    prefetchPage(page - 1);
    prefetchPage(page + 1);
    prefetchPage(page + 2);
  }, [page]);

  /* Watch for QCF font to finish loading so we switch to glyph codes */
  useEffect(() => {
    setQcfReady(false);
    if (typeof document === 'undefined') return;
    document.fonts.load(`16px '${qcfFamily}'`).then(() => setQcfReady(true)).catch(() => {});
  }, [qcfFamily]);

  /* Auto-scroll highlighted verse into view */
  useEffect(() => {
    if (autoFollow && hlRef.current) {
      hlRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter, currentVerse, autoFollow]);

  /* Build physical page render items from sorted API lines */
  type RenderItem =
    | { type: 'surah_header'; chapterId: number }
    | { type: 'bismillah'; key: string }
    | { type: 'line'; lineNum: number; words: MushafWord[] };

  const renderItems = useMemo<RenderItem[]>(() => {
    if (!data) return [];
    const sorted = [...data.lines].sort((a, b) => a.lineNum - b.lineNum);
    const result: RenderItem[] = [];
    let prevCh = -1;
    for (const line of sorted) {
      const fw = line.words[0];
      if (fw && fw.chapterId !== prevCh && fw.verseNumber === 1) {
        result.push({ type: 'surah_header', chapterId: fw.chapterId });
        if (!NO_BISMILLAH.has(fw.chapterId)) result.push({ type: 'bismillah', key: `bm-${fw.chapterId}` });
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
      background: '#F8EBD5', minHeight: '100%', width: '100%',
      display: 'flex', flexDirection: 'column',
      userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      {/* Inject QCF font-faces for this page and neighbours */}
      <QCFFontLoader pages={[page - 1, page, page + 1]} />

      {/* ── Physical page top metadata ── */}
      <div style={{ paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
        <GoldRule />
        <MushafTopMetadata meta={meta} surahLabel={surahLabel} />
        <GoldRule />
      </div>

      {/* ── Page body ── */}
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
        <div style={{
          flex: 1,
          padding: '4px 0',
          paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          overflowX: 'hidden',
        }}>
          {renderItems.map((item) => {
            if (item.type === 'surah_header') {
              return <SurahHeader key={`sh-${item.chapterId}`} chapterId={item.chapterId} />;
            }
            if (item.type === 'bismillah') {
              return <BismillahLine key={item.key} />;
            }

            /*
             * Physical Mushaf line.
             *
             * Words flow naturally RTL inside a centered flex container.
             * NO justify-content: space-between — the QCF font's glyph widths
             * determine natural inter-word spacing, just like the printed page.
             *
             * When the QCF font has loaded, we switch word content from
             * text_uthmani (Amiri Quran) to code_v2 (QCF glyph codes).
             * The QCF font renders the PUA-encoded glyphs as authentic Mushaf
             * typography where each page's font matches that page's line widths.
             */
            const { lineNum, words } = item;
            return (
              <div key={lineNum} dir="rtl" style={{
                display: 'flex',
                direction: 'rtl',
                justifyContent: 'center',   /* center the completed line — NO stretching */
                alignItems: 'baseline',
                padding: '0 12px',
                lineHeight: 2.4,
              }}>
                {words.map((word, wi) => {
                  const isEnd = word.charType === 'end';
                  const isHl = isPlaying === true
                    && !isEnd
                    && word.chapterId === currentChapter
                    && word.verseNumber === currentVerse;
                  const attachRef = isHl && !hlRefAttached;
                  if (attachRef) hlRefAttached = true;

                  /*
                   * With QCF: use code_v2 — the PUA-encoded glyph for this word.
                   * Without QCF (font still loading): fall back to text_uthmani
                   * with ۝ prepended to end markers so Amiri Quran shows the ornament.
                   */
                  const txt = qcfReady
                    ? (word.codeV2 || word.text)
                    : isEnd
                      ? (word.text.startsWith('۝') ? word.text : `۝${word.text}`)
                      : word.text;

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
                        fontFamily: qcfReady ? qcfFont : META_FONT,
                        fontSize: isEnd ? 17 : 19,
                        color: isEnd ? '#b89840' : '#010101',
                        background: isHl ? 'rgba(190,160,80,0.22)' : 'transparent',
                        borderRadius: isHl ? 4 : 0,
                        padding: isHl ? '1px 3px' : undefined,
                        cursor: isEnd ? 'default' : 'pointer',
                        transition: 'background .15s',
                        WebkitTouchCallout: 'none',
                        whiteSpace: 'nowrap',
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
