'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/Toast';
import Icon from '@/components/media/Icon';

/**
 * /badge — «بادج مسلم ليدر». A member picks a photo, places it, and downloads it with the
 * badge on it, to use anywhere they like. It has nothing to do with any profile photo on
 * the site.
 *
 * The photo NEVER leaves the device: it is decoded, framed and composed on a canvas in the
 * browser, and the download is that canvas. Nothing is uploaded, nothing is stored.
 *
 * Geometry. Facebook and WhatsApp show a profile picture as a CIRCLE, which cuts the corners
 * of the square off. A badge in the square's corner would vanish, so the badge sits INSIDE
 * the inscribed circle, on its edge at 45°, where a "verified" or "online" mark sits and
 * where a face rarely is. The output is still the full square (1080×1080), so it works both
 * where pictures are round and where they are not.
 */

const S = 1080;                       // output side, px
const BADGE = 0.27;                   // seal diameter as a share of the side
const LOGO_SRC = '/Moslimleader-logo.svg';
const LOGO_RATIO = 756.97 / 993.94;   // the logo's own width / height
const GOLD = '#F5C518';
const NAVY = '#1a1a2e';

type Corner = 'br' | 'bl' | 'tr' | 'tl';
type Style = 'seal' | 'named';
type Frame = { zoom: number; x: number; y: number }; // x/y: the photo's centre offset, in output px

const CORNER_ANGLE: Record<Corner, number> = { br: 45, bl: 135, tl: 225, tr: 315 };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}

/** How big the photo is drawn: `zoom` 1 = it just covers the square. */
function coverSize(img: HTMLImageElement, zoom: number) {
  const k = (S / Math.min(img.naturalWidth, img.naturalHeight)) * zoom;
  return { w: img.naturalWidth * k, h: img.naturalHeight * k };
}

/** Keep the photo covering the whole square — no empty strip at any edge. */
function clampFrame(img: HTMLImageElement, f: Frame): Frame {
  const { w, h } = coverSize(img, f.zoom);
  const mx = Math.max(0, (w - S) / 2), my = Math.max(0, (h - S) / 2);
  return { zoom: f.zoom, x: Math.min(mx, Math.max(-mx, f.x)), y: Math.min(my, Math.max(-my, f.y)) };
}

function drawBadge(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, corner: Corner, style: Style, label: string) {
  const d = S * BADGE;
  const r = d / 2;
  // With the name under it, the whole mark is taller; move it further in so the label stays
  // inside the circle too.
  const margin = S * (style === 'named' ? 0.075 : 0.03);
  const dist = S / 2 - r - margin;
  const a = (CORNER_ANGLE[corner] * Math.PI) / 180;
  const cx = S / 2 + dist * Math.cos(a);
  const cy = S / 2 + dist * Math.sin(a) - (style === 'named' && corner.startsWith('b') ? S * 0.02 : 0);

  ctx.save();
  // Soft shadow, so the seal lifts off any photo, light or dark.
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = S * 0.02;
  ctx.shadowOffsetY = S * 0.005;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();

  // Gold ring, then a thin navy line inside it: reads on white walls and on black jackets.
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - d * 0.035, 0, Math.PI * 2);
  ctx.lineWidth = d * 0.07; ctx.strokeStyle = GOLD; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - d * 0.085, 0, Math.PI * 2);
  ctx.lineWidth = d * 0.012; ctx.strokeStyle = NAVY; ctx.stroke();
  ctx.restore();

  if (logo) {
    const lh = d * 0.62;
    const lw = lh * LOGO_RATIO;
    ctx.drawImage(logo, cx - lw / 2, cy - lh / 2 + d * 0.01, lw, lh);
  }

  if (style === 'named') {
    const fs = d * 0.15;
    ctx.save();
    ctx.font = `900 ${fs}px Cairo, "Noto Sans Arabic", sans-serif`;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width;
    const pw = Math.max(d * 0.95, tw + fs * 1.4);
    const ph = fs * 1.75;
    const px = cx - pw / 2;
    const py = cy + r - ph * 0.45;
    ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = S * 0.012;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, ph / 2);
    ctx.fillStyle = NAVY; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = d * 0.02; ctx.strokeStyle = GOLD; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, py + ph / 2 + fs * 0.06);
    ctx.restore();
  }
}

export default function BadgeStudio({ signedIn }: { signedIn: boolean }) {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const tx = (ar: string, en: string) => (isEn ? en : ar);
  const { addToast } = useToast();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const [frame, setFrame] = useState<Frame>({ zoom: 1, x: 0, y: 0 });
  const [corner, setCorner] = useState<Corner>('br');
  const [style, setStyle] = useState<Style>('seal');
  const [round, setRound] = useState(true);
  const [busy, setBusy] = useState(false);
  // The finished picture, kept ready: Web Share must be called inside the tap, and making
  // the JPEG first can outlast the tap's permission to share.
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);

  const label = 'مسلم ليدر';
  const pageUrl = 'https://moslimleader.com/badge';
  const postText = tx(
    `أنا جزء من مجتمع مسلم ليدر، ووضعت البادج على صورتي بكل فخر.\nمجتمع يربّي أبناءنا على القيم والقيادة.\nاعمل البادج بتاعك: ${pageUrl}`,
    `I'm part of the Moslim Leader community, and I'm proud to wear its badge.\nA community raising our children on values and leadership.\nGet your badge: ${pageUrl}`,
  );

  useEffect(() => {
    loadImage(LOGO_SRC).then(setLogo).catch(() => setLogo(null));
    const f = document.fonts;
    if (f?.load) f.load('900 40px Cairo').then(() => setFontReady(true)).catch(() => setFontReady(true));
    else setFontReady(true);
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, []);

  // ── Render ──
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, S, S);
    if (photo) {
      const { w, h } = coverSize(photo, frame.zoom);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(photo, S / 2 - w / 2 + frame.x, S / 2 - h / 2 + frame.y, w, h);
    } else {
      // No photo yet: a quiet placeholder, so the badge can be seen before choosing one.
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#E9E3D6'); g.addColorStop(1, '#CFC6B4');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(26,26,46,.18)';
      ctx.beginPath(); ctx.arc(S / 2, S * 0.4, S * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(S / 2, S * 0.95, S * 0.32, S * 0.3, 0, Math.PI, 0); ctx.fill();
    }
    drawBadge(ctx, logo, corner, style, label);

    blobRef.current = null;
    if (!photo) return;
    const t = setTimeout(() => {
      c.toBlob(b => {
        blobRef.current = b;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = b ? URL.createObjectURL(b) : null;
      }, 'image/jpeg', 0.92);
    }, 250);
    return () => clearTimeout(t);
  }, [photo, frame, logo, corner, style, fontReady]);

  // ── Choosing a photo ──
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      addToast(tx('اختر ملف صورة.', 'Choose an image file.'), 'error');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      setPhoto(img);
      setFrame({ zoom: 1, x: 0, y: 0 });
    } catch {
      addToast(tx('المتصفح ما قدرش يفتح الصورة دي. جرّب صورة JPG أو PNG.', 'This browser could not open that image. Try a JPG or PNG.'), 'error');
    } finally {
      // The decoded <img> keeps its pixels; the file URL is no longer needed.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  // ── Drag to place, pinch / wheel to zoom ──
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ frame: Frame; dist: number; cx: number; cy: number } | null>(null);
  const scaleToOutput = () => S / (canvasRef.current?.getBoundingClientRect().width || S);

  const setZoom = useCallback((z: number) => {
    if (!photo) return;
    setFrame(f => clampFrame(photo, { ...f, zoom: Math.min(4, Math.max(1, z)) }));
  }, [photo]);

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { frame, dist, cx, cy };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!photo) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!photo || !pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const k = scaleToOutput();
    let zoom = g.frame.zoom;
    if (pts.length > 1 && g.dist > 0) {
      zoom = Math.min(4, Math.max(1, g.frame.zoom * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist)));
    }
    setFrame(clampFrame(photo, { zoom, x: g.frame.x + (cx - g.cx) * k, y: g.frame.y + (cy - g.cy) * k }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) startGesture(); else gesture.current = null;
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !photo) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setFrame(f => clampFrame(photo, { ...f, zoom: Math.min(4, Math.max(1, f.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))) }));
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [photo]);

  // ── Download / share ──
  const fileName = 'moslimleader-badge.jpg';
  const ensureBlob = () => new Promise<Blob | null>(resolve => {
    if (blobRef.current) return resolve(blobRef.current);
    canvasRef.current?.toBlob(b => { blobRef.current = b; resolve(b); }, 'image/jpeg', 0.92);
  });

  const download = async () => {
    const b = await ensureBlob();
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    addToast(tx('تم تحميل الصورة', 'Picture downloaded'), 'success');
  };

  const nav = typeof navigator !== 'undefined' ? navigator as Navigator & { canShare?: (d: ShareData) => boolean } : null;
  const sharePicture = async () => {
    const b = blobRef.current;
    if (!b || !nav?.share) { await download(); return; }
    const file = new File([b], fileName, { type: 'image/jpeg' });
    if (nav.canShare && !nav.canShare({ files: [file] })) { await download(); return; }
    setBusy(true);
    try { await nav.share({ files: [file], text: postText }); }
    catch (e) { if ((e as Error)?.name !== 'AbortError') await download(); }
    finally { setBusy(false); }
  };

  const copyPost = async () => {
    try {
      await navigator.clipboard.writeText(postText);
    } catch {
      const t = document.createElement('textarea');
      t.value = postText; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { /* nothing more to try */ }
      t.remove();
    }
    addToast(tx('تم نسخ نص البوست', 'Post text copied'), 'success');
  };

  const loginHref = (signup = false) => `/login?${signup ? 'mode=signup&' : ''}redirect=${encodeURIComponent('/badge')}`;

  const corners: { id: Corner; ar: string; en: string }[] = [
    { id: 'br', ar: 'أسفل اليمين', en: 'Bottom right' },
    { id: 'bl', ar: 'أسفل اليسار', en: 'Bottom left' },
    { id: 'tr', ar: 'أعلى اليمين', en: 'Top right' },
    { id: 'tl', ar: 'أعلى اليسار', en: 'Top left' },
  ];

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="bg-[#F6F3EC] text-[#1a1a2e] min-h-screen">
      <section className="bg-[#1a1a2e] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-28 sm:pt-36 pb-10 sm:pb-14">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-bold text-[#F5C518]">
            <Icon name="badge" size={14} /> {tx('بفخر الانتساب', 'Proud to belong')}
          </p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black leading-tight">{tx('بادج مسلم ليدر على صورتك', 'The Moslim Leader badge on your picture')}</h1>
          <p className="mt-3 max-w-2xl text-white/80 leading-relaxed">
            {tx('ارفع صورتك، وضع عليها البادج في زاوية لا تغطي وجهك، وحمّلها لتستخدمها في أي مكان.',
              'Add your picture, place the badge in a corner that keeps your face clear, and download it to use anywhere.')}
          </p>
          <ol className="mt-6 flex flex-wrap gap-2 text-sm">
            {[tx('ارفع صورتك', 'Add your picture'), tx('اضبطها واختر مكان البادج', 'Frame it and place the badge'), tx('حمّلها وشاركها', 'Download and share')].map((s, i) => (
              <li key={i} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                <span className="w-5 h-5 rounded-full bg-[#F5C518] text-[#1a1a2e] text-[11px] font-black inline-flex items-center justify-center tabular-nums">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 grid gap-6 lg:grid-cols-[1.1fr_1fr] items-start">
        {/* Stage — the canvas IS the downloaded picture, shown round the way profiles show it. */}
        <div className="rounded-3xl bg-white border border-[#1a1a2e]/5 p-4 sm:p-6">
          <div className="relative mx-auto w-full max-w-[440px] aspect-square">
            <canvas ref={canvasRef} width={S} height={S}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
              className={`block w-full h-full select-none transition-[border-radius] ${round ? 'rounded-full' : 'rounded-2xl'} ${photo ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ touchAction: photo ? 'none' : 'auto', boxShadow: '0 10px 30px rgba(26,26,46,.15)' }}
              aria-label={tx('معاينة الصورة مع البادج', 'Preview of the picture with the badge')} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
            <div role="tablist" aria-label={tx('شكل المعاينة', 'Preview shape')} className="inline-flex rounded-full bg-[#F6F3EC] p-1">
              {[{ v: true, ar: 'دائرة (كما في فيسبوك وواتساب)', en: 'Round (as on Facebook & WhatsApp)' }, { v: false, ar: 'مربع', en: 'Square' }].map(o => (
                <button key={String(o.v)} type="button" role="tab" aria-selected={round === o.v} onClick={() => setRound(o.v)}
                  className={`px-3 py-1.5 rounded-full transition ${round === o.v ? 'bg-[#1a1a2e] text-white' : 'text-[#1a1a2e]/70'}`}>
                  {isEn ? o.en : o.ar}
                </button>
              ))}
            </div>
          </div>

          {photo && (
            <label className="mt-4 flex items-center gap-3 text-xs font-bold text-[#1a1a2e]/70">
              <Icon name="resize" size={14} />
              {tx('تكبير', 'Zoom')}
              {/* Left→right in both languages, like every bar on the site. */}
              <input dir="ltr" type="range" min={1} max={4} step={0.01} value={frame.zoom} onChange={e => setZoom(Number(e.target.value))}
                className="flex-1 accent-[#1a1a2e]" aria-label={tx('تكبير الصورة', 'Zoom the picture')} />
            </label>
          )}
          {photo && (
            <p className="mt-2 text-center text-xs text-[#1a1a2e]/55">{tx('اسحب الصورة لتحريكها، وكبّرها بإصبعين أو بالشريط.', 'Drag the picture to move it; zoom with two fingers or the slider.')}</p>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {!signedIn ? (
            <div className="rounded-3xl bg-[#1a1a2e] text-white p-5 sm:p-7">
              <p className="flex items-start gap-2 text-sm leading-relaxed text-white/85">
                <Icon name="info" size={18} className="mt-0.5 shrink-0 text-[#F5C518]" />
                {tx('البادج متاح لأصحاب الحسابات على مسلم ليدر. سجّل دخولك، أو أنشئ حساباً لو ما عندكش.',
                  'The badge is for Moslim Leader account holders. Sign in, or create an account if you have none.')}
              </p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                <a href={loginHref()} className="inline-flex items-center justify-center rounded-full bg-[#F5C518] text-[#1a1a2e] font-black px-5 py-3 hover:bg-white transition">
                  {tx('تسجيل الدخول', 'Sign in')}
                </a>
                <a href={loginHref(true)} className="inline-flex items-center justify-center rounded-full border border-white/25 text-white font-black px-5 py-3 hover:bg-white/10 transition">
                  {tx('إنشاء حساب', 'Create an account')}
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-3xl bg-white border border-[#1a1a2e]/5 p-5">
                <h2 className="font-black text-lg">{tx('١. صورتك', '1. Your picture')}</h2>
                <input ref={inputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" onClick={() => inputRef.current?.click()}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#1a1a2e] text-white font-black px-5 py-3 hover:bg-[#2a2a4e] transition">
                  <Icon name="upload" size={18} /> {photo ? tx('اختر صورة أخرى', 'Choose another picture') : tx('اختر صورة', 'Choose a picture')}
                </button>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-[#1a1a2e]/60 leading-relaxed">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  {tx('صورتك لا تُرفع لأي مكان — كل شيء يتم على جهازك.', 'Your picture is not uploaded anywhere — everything happens on your device.')}
                </p>
              </div>

              <div className="rounded-3xl bg-white border border-[#1a1a2e]/5 p-5">
                <h2 className="font-black text-lg">{tx('٢. البادج', '2. The badge')}</h2>
                <p className="mt-3 text-xs font-bold text-[#1a1a2e]/60">{tx('الشكل', 'Style')}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([{ id: 'seal', ar: 'الختم', en: 'Seal' }, { id: 'named', ar: 'الختم مع الاسم', en: 'Seal with name' }] as const).map(o => (
                    <button key={o.id} type="button" onClick={() => setStyle(o.id)} aria-pressed={style === o.id}
                      className={`rounded-2xl border px-3 py-2.5 text-sm font-bold transition ${style === o.id ? 'border-[#1a1a2e] ring-2 ring-[#F5C518]' : 'border-[#1a1a2e]/10 hover:border-[#1a1a2e]/30'}`}>
                      {isEn ? o.en : o.ar}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs font-bold text-[#1a1a2e]/60">{tx('المكان', 'Position')}</p>
                <div className="mt-2 grid grid-cols-2 gap-2" dir="ltr">
                  {/* Laid out as the picture's own corners, so it reads left/right the same in both languages. */}
                  {(['tl', 'tr', 'bl', 'br'] as Corner[]).map(id => {
                    const c = corners.find(x => x.id === id)!;
                    return (
                      <button key={id} type="button" onClick={() => setCorner(id)} aria-pressed={corner === id}
                        className={`rounded-2xl border px-3 py-2.5 text-sm font-bold transition ${corner === id ? 'border-[#1a1a2e] ring-2 ring-[#F5C518]' : 'border-[#1a1a2e]/10 hover:border-[#1a1a2e]/30'}`}>
                        {isEn ? c.en : c.ar}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-[#1a1a2e] text-white p-5 sm:p-6">
                <h2 className="font-black text-lg">{tx('٣. حمّلها وشاركها', '3. Download and share')}</h2>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <button type="button" onClick={download} disabled={!photo}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F5C518] text-[#1a1a2e] font-black px-5 py-3 hover:bg-white transition disabled:opacity-40">
                    <Icon name="download" size={18} /> {tx('تحميل الصورة', 'Download picture')}
                  </button>
                  <button type="button" onClick={sharePicture} disabled={!photo || busy}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 text-white font-black px-5 py-3 hover:bg-white/10 transition disabled:opacity-40">
                    {busy ? <Icon name="loader" size={18} spin /> : <Icon name="share" size={18} />} {tx('مشاركة الصورة', 'Share picture')}
                  </button>
                </div>
                {!photo && <p className="mt-2 text-xs text-white/55">{tx('اختر صورتك أولاً.', 'Choose your picture first.')}</p>}
                <p className="mt-2 text-xs text-white/55" dir="ltr" style={{ textAlign: isEn ? 'left' : 'right' }}>JPG · 1080×1080</p>

                <div className="mt-5 pt-5 border-t border-white/10">
                  <p className="text-xs font-bold text-[#F5C518]">{tx('بوست الانتماء', 'The belonging post')}</p>
                  <p className="mt-2 rounded-2xl bg-white/[0.06] p-3 text-sm leading-relaxed whitespace-pre-line text-white/85">{postText}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <button type="button" onClick={copyPost} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 hover:bg-white/20">
                      <Icon name="link" size={14} /> {tx('نسخ النص', 'Copy text')}
                    </button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(postText)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] text-white px-3 py-2 hover:bg-[#1ebe5b]">
                      <Icon name="send" size={14} /> {tx('واتساب', 'WhatsApp')}
                    </a>
                    <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2] text-white px-3 py-2 hover:bg-[#166fe0]">
                      <Icon name="external" size={14} /> {tx('فيسبوك', 'Facebook')}
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
