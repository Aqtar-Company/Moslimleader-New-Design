'use client';
import { useEffect, useState, useRef } from 'react';

interface MushafWord {
  text: string;
  codeV1: string;
  codeV2: string;
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
  onAyahTap?: (info: { chapterId: number; verseNumber: number; text: string }) => void;
  autoFollow?: boolean;
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

const JUZ_AR = ['','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون','الحادي والعشرون','الثاني والعشرون','الثالث والعشرون','الرابع والعشرون','الخامس والعشرون','السادس والعشرون','السابع والعشرون','الثامن والعشرون','التاسع والعشرون','الثلاثون'];

function juzName(n: number) { return JUZ_AR[n] ? `الجزء ${JUZ_AR[n]}` : `الجزء ${n}`; }
function toEastern(n: number) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]); }

// Determine line content type
function lineType(words: MushafWord[]): 'surah_name' | 'bismillah' | 'end' | 'verse' {
  const types = words.map(w => w.charType);
  if (types.some(t => t === 'chapter_name' || t === 'surah_name')) return 'surah_name';
  if (types.some(t => t === 'bismillah')) return 'bismillah';
  if (types.length === 1 && types[0] === 'end') return 'end';
  return 'verse';
}

// Surah header banner
function SurahBanner({ surahId }: { surahId: number }) {
  return (
    <div dir="rtl" style={{ margin: '10px 6px 6px', position: 'relative', lineHeight: 0 }}>
      <img src="/surah_header_mushaf.svg" alt="" aria-hidden="true" style={{ display: 'block', width: '100%', height: 'auto' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Amiri Quran','Scheherazade New',serif", fontSize: 'clamp(13px,3.8vw,20px)', fontWeight: 700, color: '#1a0800', letterSpacing: 2 }}>
          سورة {SURAH_AR[surahId] ?? ''}
        </span>
      </div>
    </div>
  );
}

// Gold double-line divider
function GoldLine() {
  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{ height: 1.5, background: 'linear-gradient(90deg,transparent,#c8a84b 20%,#c8a84b 80%,transparent)' }} />
      <div style={{ height: 0.5, background: 'linear-gradient(90deg,transparent,#c8a84b 20%,#c8a84b 80%,transparent)', marginTop: 2 }} />
    </div>
  );
}

export default function MushafQCFPage({ page, currentChapter, currentVerse, onVerseClick, onAyahTap, autoFollow = true }: Props) {
  const [lines, setLines] = useState<MushafLineData[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ juz: null, hizb: null, surahs: [] });
  const [loading, setLoading] = useState(true);
  const [fontReady, setFontReady] = useState(false);
  const activeRef = useRef<HTMLDivElement | null>(null);

  const padded = String(page).padStart(3, '0');
  const fontFamily = `QCF_P${padded}`;
  const fontUrl = `/api/tareeq/quran/qcf-font?page=${page}`;

  // Load per-page QCF4 font
  useEffect(() => {
    setFontReady(false);
    const styleId = `qcf-style-${page}`;
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      el.textContent = `@font-face{font-family:'${fontFamily}';src:url('${fontUrl}') format('woff2');font-display:swap;}`;
      document.head.appendChild(el);
    }
    document.fonts.load(`16px '${fontFamily}'`).then(() => setFontReady(true)).catch(() => setFontReady(true));
  }, [page, fontFamily, fontUrl]);

  // Fetch line data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/tareeq/quran/mushaf-lines?page=${page}`)
      .then(r => r.json())
      .then(d => { setLines(d.lines ?? []); if (d.meta) setMeta(d.meta); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  // Scroll active verse into view
  useEffect(() => {
    if (autoFollow && activeRef.current) activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentVerse, currentChapter, autoFollow]);

  const surahHeaderLabel = meta.surahs.length > 1
    ? meta.surahs.map(id => SURAH_AR[id] ?? '').filter(Boolean).join(' و')
    : (SURAH_AR[meta.surahs[0] ?? currentChapter] ?? '');

  if (loading || !fontReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, background: '#F9F4E8' }}>
        <style>{`@keyframes ms-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2.5px solid rgba(200,168,75,0.2)', borderTopColor: '#c8a84b', animation: 'ms-spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ background: '#F9F4E8', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ paddingTop: 8, paddingBottom: 4 }}>
        <GoldLine />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: "'Amiri','Scheherazade New',serif" }}>
            {meta.juz ? juzName(meta.juz) : ''}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4V4z" fill="#c8a84b" opacity="0.85"/>
            <path d="M20 4h-6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6V4z" fill="#c8a84b" opacity="0.5"/>
            <line x1="12" y1="6" x2="12" y2="18" stroke="#fff" strokeWidth="0.8"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a3e10', fontFamily: "'Amiri','Scheherazade New',serif" }}>
            {surahHeaderLabel}
          </span>
        </div>
        <GoldLine />
      </div>

      {/* ── Quran Lines ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '4px 0' }}>
        {lines.map(line => {
          const ltype = lineType(line.words);

          // Surah name line → ornamental banner
          if (ltype === 'surah_name') {
            return <SurahBanner key={line.lineNum} surahId={line.words[0]?.chapterId ?? 0} />;
          }

          // Bismillah line → centered with QCF4 font
          if (ltype === 'bismillah') {
            const bsmWords = line.words.filter(w => w.charType === 'bismillah');
            return (
              <div key={line.lineNum} style={{ textAlign: 'center', padding: '0 16px', direction: 'rtl' }}>
                {bsmWords.map((w, wi) => (
                  <span key={wi} style={{ fontFamily: `'${fontFamily}'`, fontSize: 'clamp(18px,5vw,26px)', color: '#1a0800', letterSpacing: 1 }}>
                    {w.codeV2 || w.text}
                  </span>
                ))}
              </div>
            );
          }

          // End ornament (surah end) — centered
          if (ltype === 'end') {
            return (
              <div key={line.lineNum} style={{ textAlign: 'center', padding: '0 16px', color: '#c8a84b', fontSize: 14, letterSpacing: 8, fontFamily: "'Amiri Quran',serif" }}>
                ❧ ﴾ ❧
              </div>
            );
          }

          // Verse line — flex RTL, words spread across full width
          const activeVerseWords = line.words.filter(w =>
            w.chapterId === currentChapter && w.verseNumber === currentVerse && w.charType === 'word'
          );
          const isActiveLine = activeVerseWords.length > 0;

          // Collect verse text for onAyahTap
          const verseTextMap: Record<string, string> = {};
          line.words.filter(w => w.charType === 'word').forEach(w => {
            const key = `${w.chapterId}-${w.verseNumber}`;
            verseTextMap[key] = (verseTextMap[key] ?? '') + (verseTextMap[key] ? ' ' : '') + w.text;
          });

          return (
            <div
              key={line.lineNum}
              ref={isActiveLine ? activeRef : null}
              dir="rtl"
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 14px',
                minHeight: 'clamp(32px, 6vw, 44px)',
              }}
            >
              {line.words.map((word, wi) => {
                const isEnd = word.charType === 'end';
                const isActiveWord = word.chapterId === currentChapter && word.verseNumber === currentVerse && word.charType === 'word';
                const verseKey = `${word.chapterId}-${word.verseNumber}`;

                return (
                  <span
                    key={wi}
                    onClick={() => {
                      if (word.charType === 'word') {
                        onVerseClick?.(word.chapterId, word.verseNumber);
                        if (onAyahTap && !isEnd) {
                          onAyahTap({ chapterId: word.chapterId, verseNumber: word.verseNumber, text: verseTextMap[verseKey] ?? word.text });
                        }
                      }
                    }}
                    style={{
                      fontFamily: `'${fontFamily}'`,
                      fontSize: isEnd ? 'clamp(12px,3.2vw,18px)' : 'clamp(18px,5vw,26px)',
                      color: isEnd ? '#8b6914' : (isActiveWord ? '#4a2800' : '#1a0800'),
                      background: isActiveWord ? 'rgba(171,136,68,0.22)' : 'transparent',
                      borderRadius: isActiveWord ? 4 : 0,
                      padding: isActiveWord ? '1px 2px' : '0',
                      cursor: word.charType === 'word' ? 'pointer' : 'default',
                      transition: 'background 0.25s',
                      userSelect: 'none',
                      display: 'inline-block',
                    }}
                  >
                    {word.codeV2 || word.codeV1 || word.text}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{ paddingTop: 4, paddingBottom: 8 }}>
        <GoldLine />
        <div dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 16px' }}>
          <span style={{ fontSize: 11, color: '#5a3e10', fontFamily: "'Amiri','Scheherazade New',serif", fontWeight: 600 }}>
            {meta.hizb ? `الحزب ${toEastern(meta.hizb)}` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#c8a84b' }}>◆</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#5a3e10', fontFamily: "'Amiri','Scheherazade New',serif" }}>
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
