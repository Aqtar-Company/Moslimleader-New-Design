'use client';
import { useEffect, useState, useMemo } from 'react';

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

function juzName(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `الجزء ${n}`; }
function toEastern(n: number) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]); }

function GoldLine() {
  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{ height: 1.5, background: 'linear-gradient(90deg,transparent,#c8a84b 20%,#c8a84b 80%,transparent)' }} />
      <div style={{ height: 0.5, background: 'linear-gradient(90deg,transparent,#c8a84b 20%,#c8a84b 80%,transparent)', marginTop: 2 }} />
    </div>
  );
}

function SurahNameBadge({ chapterId }: { chapterId: number }) {
  const name = SURAH_AR[chapterId] ?? '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '2px 0', flexShrink: 0 }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #c8a84b80)' }} />
      <div style={{
        padding: '3px 18px',
        border: '1px solid rgba(200,168,75,0.65)',
        borderRadius: 4,
        fontSize: 13,
        fontWeight: 700,
        color: '#5a3e10',
        fontFamily: "'Amiri Quran','Scheherazade New',serif",
        background: 'rgba(200,168,75,0.08)',
        whiteSpace: 'nowrap',
      }}>
        سورة {name}
      </div>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #c8a84b80)' }} />
    </div>
  );
}

interface PageMeta { juz: number | null; hizb: number | null; surahs: number[]; }
interface MushafWord { text: string; charType: string; verseNumber: number; chapterId: number; lineNumber: number; }
interface MushafLine { lineNum: number; words: MushafWord[]; }

interface Props {
  page: number;
  currentChapter: number;
  currentVerse: number;
  onVerseClick?: (chapter: number, verse: number) => void;
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  autoFollow?: boolean;
}

type RenderItem = { type: 'surah'; chapterId: number } | { type: 'line'; line: MushafLine };

export default function MushafQCFPage({ page, currentChapter, currentVerse, onVerseClick, onAyahTap }: Props) {
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ juz: null, hizb: null, surahs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const qFont = "'Amiri Quran','Scheherazade New','Traditional Arabic',serif";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
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

  // Find lines where a new surah starts (verse 1)
  const surahHeaderMap = useMemo(() => {
    const map = new Map<number, number>(); // lineNum → chapterId
    for (const line of lines) {
      for (const word of line.words) {
        if (word.verseNumber === 1 && word.charType !== 'end') {
          if (!map.has(line.lineNum)) map.set(line.lineNum, word.chapterId);
          break;
        }
      }
    }
    return map;
  }, [lines]);

  // Build ordered render items
  const renderItems = useMemo((): RenderItem[] => {
    const items: RenderItem[] = [];
    for (const line of lines) {
      if (surahHeaderMap.has(line.lineNum)) {
        items.push({ type: 'surah', chapterId: surahHeaderMap.get(line.lineNum)! });
      }
      items.push({ type: 'line', line });
    }
    return items;
  }, [lines, surahHeaderMap]);

  const surahHeaderLabel = useMemo(
    () => meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و'),
    [meta.surahs],
  );

  return (
    <div style={{ background: '#F9F4E8', minHeight: '100%', display: 'flex', flexDirection: 'column', userSelect: 'none', WebkitUserSelect: 'none' }}>

      {/* Header */}
      <div style={{ paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
        <GoldLine />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: qFont }}>
            {meta.juz ? juzName(meta.juz) : ''}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4V4z" fill="#c8a84b" opacity="0.85"/>
            <path d="M20 4h-6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6V4z" fill="#c8a84b" opacity="0.5"/>
            <line x1="12" y1="6" x2="12" y2="18" stroke="#fff" strokeWidth="0.8"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: qFont }}>
            {surahHeaderLabel}
          </span>
        </div>
        <GoldLine />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`@keyframes ms-spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2.5px solid rgba(200,168,75,0.2)', borderTopColor: '#c8a84b', animation: 'ms-spin 0.7s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#9a7a40', fontFamily: qFont, fontSize: 14 }}>تعذّر تحميل الصفحة</p>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          padding: '4px 10px',
        }}>
          {renderItems.map((item, idx) => {
            if (item.type === 'surah') {
              return <SurahNameBadge key={`s${item.chapterId}-${idx}`} chapterId={item.chapterId} />;
            }
            const { line } = item;
            const wordCount = line.words.length;
            const justifyContent = wordCount <= 3 ? 'center' : 'space-between';

            return (
              <div
                key={line.lineNum}
                dir="rtl"
                style={{
                  display: 'flex',
                  justifyContent,
                  alignItems: 'center',
                  gap: wordCount <= 3 ? 6 : 0,
                  flexShrink: 0,
                  minHeight: 32,
                }}
              >
                {line.words.map((word, wi) => {
                  const isEnd = word.charType === 'end';
                  const isHl = !isEnd && word.chapterId === currentChapter && word.verseNumber === currentVerse;

                  return (
                    <span
                      key={wi}
                      onClick={() => {
                        if (isEnd) return;
                        onAyahTap?.({ chapterId: word.chapterId, verseNumber: word.verseNumber, text: word.text });
                        onVerseClick?.(word.chapterId, word.verseNumber);
                      }}
                      style={{
                        fontFamily: qFont,
                        fontSize: isEnd ? 13 : 21,
                        lineHeight: 2,
                        color: isEnd ? '#c8a84b' : (isHl ? '#3d1800' : '#1a0800'),
                        background: isHl ? 'rgba(200,168,75,0.22)' : 'transparent',
                        borderRadius: isHl ? 6 : 0,
                        padding: isEnd ? '0 2px' : (isHl ? '1px 4px' : '1px 2px'),
                        cursor: isEnd ? 'default' : 'pointer',
                        display: 'inline-block',
                        transition: 'background 0.25s, color 0.25s',
                        WebkitTouchCallout: 'none',
                      }}
                    >
                      {word.text}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ paddingTop: 4, paddingBottom: 8, flexShrink: 0 }}>
        <GoldLine />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 16px' }}>
          <span style={{ fontSize: 11, color: '#5a3e10', fontFamily: qFont, fontWeight: 600 }}>
            {meta.hizb ? `الحزب ${toEastern(meta.hizb)}` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#c8a84b' }}>◆</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#5a3e10', fontFamily: qFont }}>
              {toEastern(page)}
            </span>
            <span style={{ fontSize: 9, color: '#c8a84b' }}>◆</span>
          </div>
          <span style={{ fontSize: 11, color: 'transparent', userSelect: 'none' }}>0</span>
        </div>
        <GoldLine />
      </div>
    </div>
  );
}
