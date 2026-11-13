'use client';

import { useMemo, useState } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/Toast';
import Icon from '@/components/media/Icon';

/**
 * /logo — «شعار مسلم ليدر للطباعة». Pick a design, try it on a shirt colour (or a plain
 * background), download the print file, or hand it straight to a print shop on WhatsApp.
 *
 * WhatsApp: on a phone the FILE itself is handed to the share sheet (Web Share with files),
 * so the print shop receives the design, not a link it has to open. Fetching the file can
 * outlast the tap's permission to share; then the button turns into «اضغط لإرسال الملف»
 * holding the file already fetched, and the next tap shares it. Where files cannot be
 * shared (most desktops), WhatsApp opens with a message carrying the download link.
 */
type Design = {
  id: number; title: string; note: string | null; fileType: string; fileSize: number;
  width: number | null; height: number | null; previewUrl: string | null; fileUrl: string; downloads: number;
};
type Banner = { imageUrl: string | null; title: string; subtitle: string };

const SHIRTS: { hex: string; ar: string; en: string }[] = [
  { hex: '#FFFFFF', ar: 'أبيض', en: 'White' },
  { hex: '#141414', ar: 'أسود', en: 'Black' },
  { hex: '#1B2541', ar: 'كحلي', en: 'Navy' },
  { hex: '#3F3F46', ar: 'فحمي', en: 'Charcoal' },
  { hex: '#A1A1AA', ar: 'رمادي', en: 'Grey' },
  { hex: '#E9DFC9', ar: 'بيج', en: 'Beige' },
  { hex: '#6B1F2A', ar: 'نبيتي', en: 'Burgundy' },
  { hex: '#4B5A2A', ar: 'زيتي', en: 'Olive' },
  { hex: '#2F5DA8', ar: 'أزرق', en: 'Blue' },
  { hex: '#D4A017', ar: 'خردلي', en: 'Mustard' },
];

const fileName = (d: Design) => `moslim-leader-design-${d.id}.${d.fileType}`;
const sizeMb = (n: number) => (n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1);
/** Light colours need a darker outline for the shirt to read against the page. */
const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 170;
};

export default function LogoStudio({ designs, banner }: { designs: Design[]; banner: Banner }) {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const tx = (ar: string, en: string) => (isEn ? en : ar);
  const { addToast } = useToast();

  const [selId, setSelId] = useState<number | null>(designs[0]?.id ?? null);
  const [color, setColor] = useState(SHIRTS[1].hex);
  const [mode, setMode] = useState<'shirt' | 'flat'>('shirt');
  const [scale, setScale] = useState(42);
  const [sharing, setSharing] = useState(false);
  const [pending, setPending] = useState<{ file: File; text: string } | null>(null);
  const sel = useMemo(() => designs.find(d => d.id === selId) ?? null, [designs, selId]);

  const printSize = sel?.width && sel.height
    ? { w: Math.round((sel.width / 300) * 2.54), h: Math.round((sel.height / 300) * 2.54) }
    : null;

  const share = async () => {
    if (!sel) return;
    const link = `${window.location.origin}/api/logo-designs/${sel.id}/download`;
    const text = tx(
      `تصميم «${sel.title}» من مسلم ليدر — للطباعة على تيشرت.${sel.note ? `\n${sel.note}` : ''}\nملف الطباعة: ${link}`,
      `“${sel.title}” — a Moslim Leader design for t-shirt printing.${sel.note ? `\n${sel.note}` : ''}\nPrint file: ${link}`,
    );
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (pending) {
      try { await nav.share({ files: [pending.file], text: pending.text }); } catch { /* closed */ }
      setPending(null);
      return;
    }
    setSharing(true);
    try {
      if (nav.canShare && nav.share) {
        const res = await fetch(`${link}?share=1`, { signal: AbortSignal.timeout(30_000) });
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], fileName(sel), { type: blob.type || 'application/octet-stream' });
          if (nav.canShare({ files: [file] })) {
            try { await nav.share({ files: [file], text }); return; }
            catch (e) {
              const name = (e as Error)?.name;
              if (name === 'AbortError') return;                       // they closed the sheet
              if (name === 'NotAllowedError') { setPending({ file, text }); return; } // the tap expired
            }
          }
        }
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } finally { setSharing(false); }
  };

  const copyLink = async () => {
    if (!sel) return;
    const link = `${window.location.origin}/api/logo-designs/${sel.id}/download`;
    try { await navigator.clipboard.writeText(link); addToast(tx('تم نسخ رابط الملف', 'File link copied'), 'success'); }
    catch { addToast(link, 'info'); }
  };

  const outline = isLight(color) ? 'rgba(26,26,46,.28)' : 'rgba(255,255,255,.14)';

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="bg-[#F6F3EC] text-[#1a1a2e] min-h-screen">
      {/* ── Banner ── */}
      <section className="relative overflow-hidden bg-[#1a1a2e] text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {banner.imageUrl && <img src={banner.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className={`absolute inset-0 ${banner.imageUrl ? 'bg-gradient-to-t from-[#1a1a2e] via-[#1a1a2e]/60 to-[#1a1a2e]/20' : ''}`} aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 pt-28 sm:pt-36 pb-10 sm:pb-14">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-bold text-[#F5C518]">
            <Icon name="download" size={14} /> {tx('للطباعة على التيشرتات', 'For t-shirt printing')}
          </p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{banner.title}</h1>
          {banner.subtitle && <p className="mt-3 max-w-2xl text-white/80 leading-relaxed">{banner.subtitle}</p>}
          <ol className="mt-6 flex flex-wrap gap-2 text-sm">
            {[tx('اختر التصميم', 'Pick a design'), tx('جرّبه على لون التيشرت', 'Try it on a shirt colour'), tx('حمّله أو ابعته للمطبعة', 'Download it or send it to the printer')].map((s, i) => (
              <li key={i} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                <span className="w-5 h-5 rounded-full bg-[#F5C518] text-[#1a1a2e] text-[11px] font-black inline-flex items-center justify-center tabular-nums">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {designs.length === 0 ? (
        <section className="max-w-6xl mx-auto px-4 sm:px-8 py-20 text-center">
          <p className="text-lg font-bold">{tx('التصميمات في الطريق — ارجع قريب.', 'Designs are on their way — check back soon.')}</p>
        </section>
      ) : (
        <>
          {/* ── Studio ── */}
          <section className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 grid gap-6 lg:grid-cols-[1.15fr_1fr] items-start">
            {/* Stage */}
            <div className="rounded-3xl bg-white border border-[#1a1a2e]/5 p-4 sm:p-6 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div role="tablist" aria-label={tx('طريقة العرض', 'View')} className="inline-flex rounded-full bg-[#F6F3EC] p-1 text-sm font-bold">
                  {(['shirt', 'flat'] as const).map(m => (
                    <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                      className={`px-4 py-1.5 rounded-full transition ${mode === m ? 'bg-[#1a1a2e] text-white' : 'text-[#1a1a2e]/70'}`}>
                      {m === 'shirt' ? tx('على تيشرت', 'On a shirt') : tx('على خلفية', 'On a background')}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#1a1a2e]/70">
                  {tx('الحجم', 'Size')}
                  <input type="range" min={20} max={70} value={scale} onChange={e => setScale(Number(e.target.value))} className="w-24 accent-[#1a1a2e]" aria-label={tx('حجم الشعار', 'Logo size')} />
                </label>
              </div>

              <div className="relative mx-auto w-full max-w-[460px] aspect-[500/560] rounded-2xl overflow-hidden transition-colors"
                style={{ background: mode === 'flat' ? color : 'linear-gradient(180deg,#EEE9DE,#E4DDCD)' }}>
                {mode === 'shirt' && (
                  <svg viewBox="0 0 500 560" className="absolute inset-0 w-full h-full" aria-hidden>
                    <defs>
                      <linearGradient id="tee-shade" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#000" stopOpacity=".14" />
                        <stop offset=".22" stopColor="#000" stopOpacity="0" />
                        <stop offset=".78" stopColor="#000" stopOpacity="0" />
                        <stop offset="1" stopColor="#000" stopOpacity=".14" />
                      </linearGradient>
                    </defs>
                    <path d="M150 48 C185 80 315 80 350 48 L458 98 L424 210 L372 190 L372 532 Q250 548 128 532 L128 190 L76 210 L42 98 Z"
                      fill={color} stroke={outline} strokeWidth={2.5} strokeLinejoin="round" style={{ transition: 'fill .25s' }} />
                    <path d="M150 48 C185 80 315 80 350 48 L458 98 L424 210 L372 190 L372 532 Q250 548 128 532 L128 190 L76 210 L42 98 Z" fill="url(#tee-shade)" />
                    <path d="M188 52 C210 96 290 96 312 52" fill="none" stroke={outline} strokeWidth={6} strokeLinecap="round" />
                    <path d="M128 190 L128 200 M372 190 L372 200" stroke={outline} strokeWidth={2} />
                  </svg>
                )}
                {sel?.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sel.previewUrl} alt={sel.title} draggable={false}
                    className="absolute left-1/2 object-contain select-none pointer-events-none"
                    // One `translate`, set here: Tailwind's -translate-x-1/2 uses the same CSS
                    // property, and combining the two shifted the logo twice in the flat view.
                    style={mode === 'shirt'
                      ? { top: '25%', translate: '-50% 0', width: `${scale * 0.62}%`, maxHeight: '48%' }
                      : { top: '50%', translate: '-50% -50%', width: `${scale}%`, maxHeight: '80%' }} />
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-[#1a1a2e]/50">{tx('لا توجد معاينة', 'No preview')}</p>
                )}
              </div>

              {/* Colours */}
              <div className="mt-4">
                <p className="text-xs font-bold text-[#1a1a2e]/60 mb-2">{mode === 'shirt' ? tx('لون التيشرت', 'Shirt colour') : tx('لون الخلفية', 'Background colour')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {SHIRTS.map(s => (
                    <button key={s.hex} type="button" onClick={() => setColor(s.hex)} aria-pressed={color === s.hex} title={isEn ? s.en : s.ar}
                      aria-label={isEn ? s.en : s.ar}
                      className={`w-9 h-9 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1a2e] ${color === s.hex ? 'ring-2 ring-offset-2 ring-[#1a1a2e] scale-110' : 'hover:scale-105'}`}
                      style={{ background: s.hex, borderColor: isLight(s.hex) ? 'rgba(26,26,46,.25)' : 'transparent' }} />
                  ))}
                  <label className="relative w-9 h-9 rounded-full overflow-hidden border border-[#1a1a2e]/20 cursor-pointer" title={tx('لون آخر', 'Another colour')}
                    style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
                    <input type="color" value={color} onChange={e => setColor(e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={tx('اختر لوناً آخر', 'Pick another colour')} />
                  </label>
                  <span className="text-xs font-bold text-[#1a1a2e]/60 tabular-nums" dir="ltr">{SHIRTS.find(s => s.hex === color)?.[isEn ? 'en' : 'ar'] ?? color}</span>
                </div>
                {sel?.fileType === 'jpg' && (
                  <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{tx('ملف JPG ما فيهوش شفافية: الخلفية البيضاء بتاعته هتتطبع زي ما هي.', 'A JPG has no transparency: its white background will be printed too.')}</p>
                )}
              </div>
            </div>

            {/* Details + actions */}
            {sel && (
              <div className="space-y-4">
                <div className="rounded-3xl bg-[#1a1a2e] text-white p-5 sm:p-7">
                  <p className="text-xs font-bold text-[#F5C518]">{tx('التصميم المختار', 'Selected design')}</p>
                  <h2 className="mt-1 text-2xl sm:text-3xl font-black leading-snug">{sel.title}</h2>
                  {sel.note && <p className="mt-2 text-white/80 leading-relaxed whitespace-pre-line">{sel.note}</p>}

                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-white/[0.06] p-3">
                      <dt className="text-white/55 text-xs">{tx('نوع الملف', 'File type')}</dt>
                      <dd className="font-black mt-0.5" dir="ltr">{sel.fileType.toUpperCase()} · {sizeMb(sel.fileSize)} MB</dd>
                    </div>
                    <div className="rounded-xl bg-white/[0.06] p-3">
                      <dt className="text-white/55 text-xs">{tx('المقاس', 'Size')}</dt>
                      <dd className="font-black mt-0.5" dir="ltr">{sel.width && sel.height ? `${sel.width}×${sel.height}px` : sel.fileType === 'svg' ? tx('متجهي', 'Vector') : '—'}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-white/65 leading-relaxed">
                    {printSize
                      ? tx(`بجودة طباعة عالية (300 نقطة/بوصة) يكفي لطباعة حتى ${printSize.w} × ${printSize.h} سم تقريباً.`, `At high print quality (300 dpi) it covers up to about ${printSize.w} × ${printSize.h} cm.`)
                      : sel.fileType === 'svg'
                        ? tx('ملف متجهي: يكبر لأي مقاس من غير ما يفقد جودته.', 'A vector file: it scales to any size without losing quality.')
                        : sel.fileType === 'pdf' ? tx('ملف PDF جاهز للمطبعة.', 'A print-ready PDF.') : ''}
                  </p>

                  <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                    <a href={`/api/logo-designs/${sel.id}/download`} download={fileName(sel)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F5C518] text-[#1a1a2e] font-black px-5 py-3 hover:bg-white transition">
                      <Icon name="download" size={18} /> {tx('تحميل ملف الطباعة', 'Download print file')}
                    </a>
                    <button type="button" onClick={share} disabled={sharing}
                      className={`inline-flex items-center justify-center gap-2 rounded-full font-black px-5 py-3 transition disabled:opacity-60 ${pending ? 'bg-white text-[#128C7E]' : 'bg-[#25D366] text-white hover:bg-[#1ebe5b]'}`}>
                      {sharing ? <Icon name="loader" size={18} spin /> : <Icon name="send" size={18} />}
                      {pending ? tx('اضغط لإرسال الملف', 'Tap to send the file') : sharing ? tx('جارٍ تجهيز الملف…', 'Preparing the file…') : tx('أرسل للمطبعة على واتساب', 'Send to the printer on WhatsApp')}
                    </button>
                  </div>
                  <button type="button" onClick={copyLink} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-white">
                    <Icon name="link" size={14} /> {tx('نسخ رابط الملف', 'Copy file link')}
                  </button>
                </div>

                <div className="rounded-3xl bg-white border border-[#1a1a2e]/5 p-5 text-sm leading-relaxed text-[#1a1a2e]/80">
                  <p className="font-black text-[#1a1a2e] mb-2">{tx('قبل ما تبعت للمطبعة', 'Before you send it to the printer')}</p>
                  <ul className="space-y-1.5 list-disc ps-5">
                    <li>{tx('ابعت الملف نفسه مش صورة شاشة — صورة الشاشة جودتها أقل بكتير.', 'Send the file itself, not a screenshot — a screenshot is far lower quality.')}</li>
                    <li>{tx('ملفات PNG الشفافة وSVG بتتطبع من غير خلفية على أي لون تيشرت.', 'Transparent PNG and SVG files print with no background on any shirt colour.')}</li>
                    <li>{tx('اتفق مع المطبعة على مكان الشعار ومقاسه بالسنتيمتر.', 'Agree on the placement and size in centimetres with the printer.')}</li>
                  </ul>
                </div>
              </div>
            )}
          </section>

          {/* ── All designs ── */}
          {designs.length > 1 && (
            <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-16 sm:pb-24">
              <h2 className="text-xl sm:text-2xl font-black mb-4">{tx('كل التصميمات', 'All designs')}</h2>
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {designs.map(d => {
                  const active = d.id === selId;
                  return (
                    <li key={d.id}>
                      <button type="button" onClick={() => { setSelId(d.id); setPending(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        aria-pressed={active}
                        className={`w-full text-start rounded-2xl bg-white border p-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1a1a2e] ${active ? 'border-[#1a1a2e] ring-2 ring-[#F5C518]' : 'border-[#1a1a2e]/5 hover:border-[#1a1a2e]/25'}`}>
                        <span className="block aspect-square rounded-xl p-3"
                          style={{ background: 'repeating-conic-gradient(#ECE7DC 0% 25%, #fff 0% 50%) 50% / 18px 18px' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {d.previewUrl && <img src={d.previewUrl} alt="" loading="lazy" className="w-full h-full object-contain" />}
                        </span>
                        <span className="block mt-2 px-1 font-bold text-sm leading-snug line-clamp-2">{d.title}</span>
                        <span className="block px-1 text-[11px] text-[#1a1a2e]/50" dir="ltr" style={{ textAlign: isEn ? 'left' : 'right' }}>{d.fileType.toUpperCase()}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
