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
/**
 * Ready pictures for members who would rather not use a photo of themselves — drawn girls
 * in hijab, cropped square with room above the head so the round crop never cuts it.
 * Files: public/badge-pictures/girl-<n>.webp (1080²) and girl-<n>-thumb.webp (240²). To add
 * one, drop both files there and raise the count.
 */
const READY_PICTURES = Array.from({ length: 5 }, (_, i) => ({
  src: `/badge-pictures/girl-${i + 1}.webp`,
  thumb: `/badge-pictures/girl-${i + 1}-thumb.webp`,
}));

const LOGO_FILL = 0.8;               // logo height as a share of the badge's diameter
// «الإطار» style
const RIBBON_BAND = 0.13;            // band thickness, as a share of the side
const RIBBON_BADGE = 0.2;            // badge diameter on the band
const RIBBON_SPREAD = (92 * Math.PI) / 180;  // the band fades out this far either side of the badge
const RIBBON_SOLID = (48 * Math.PI) / 180;   // …and is fully opaque this far

/** Background colours offered for the badge; the first is the logo's own yellow. */
const BADGE_COLORS: { hex: string; ar: string; en: string }[] = [
  { hex: '#FDBF00', ar: 'أصفر', en: 'Yellow' },
  { hex: '#FFFFFF', ar: 'أبيض', en: 'White' },
  { hex: '#1a1a2e', ar: 'كحلي', en: 'Navy' },
  { hex: '#754A2C', ar: 'بني', en: 'Brown' },
  { hex: '#1F7A4D', ar: 'أخضر', en: 'Green' },
  { hex: '#6B1F2A', ar: 'نبيتي', en: 'Burgundy' },
  { hex: '#2F5DA8', ar: 'أزرق', en: 'Blue' },
  { hex: '#141414', ar: 'أسود', en: 'Black' },
];
/** Light swatches need a border to read against the white card. */
const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) > 170;
};

type Style = 'ribbon' | 'badge';
type Frame = { zoom: number; x: number; y: number }; // x/y: the photo's centre offset, in output px

/** Always bottom centre (canvas angles run clockwise from the right, y points down), so the
 *  frame and its two words sit symmetrically under the face. */
const BADGE_ANGLE = Math.PI / 2;

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

/** The badge disc itself: a circle in `color` with the lion's face as large as fits. */
function drawSeal(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, cx: number, cy: number, d: number, color: string) {
  const r = d / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = S * 0.02;
  ctx.shadowOffsetY = S * 0.005;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
  if (logo) {
    // The shield is taller than wide; at this height its widest point and its top and
    // bottom tips all stay inside the circle.
    const lh = d * LOGO_FILL;
    const lw = lh * LOGO_RATIO;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);
    ctx.restore();
  }
}

/**
 * Style «الشارة»: the badge alone, on its own colour. No words — at the size a profile
 * picture is seen, only a shape reads.
 */
function drawBadge(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, color: string) {
  const d = S * BADGE;
  const dist = S / 2 - d / 2 - S * 0.03;
  const a = BADGE_ANGLE;
  drawSeal(ctx, logo, S / 2 + dist * Math.cos(a), S / 2 + dist * Math.sin(a), d, color);
}

// Georgia ships with Windows, macOS and iOS; elsewhere (most Android) the browser's serif.
const WORD_FONT = (size: number) => `bold ${size}px Georgia, "Times New Roman", serif`;

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/**
 * Lay a word along an arc of the picture's circle: the word is set straight on its own
 * canvas (so the browser shapes and kerns it), then copied onto the arc in thin vertical
 * strips, each rotated to its own angle. This also keeps Arabic joined, should the words
 * ever be Arabic again — drawing letter by letter would cut every connection.
 *
 * `inward`: tops of the letters point to the centre (the lower half of the circle, read
 * normally from below). Otherwise the baseline faces the centre (the upper half), so the
 * word is never upside down.
 */
function drawArcWord(ctx: CanvasRenderingContext2D, word: string, at: number, radius: number, size: number, fill: string, inward: boolean) {
  const font = WORD_FONT(size);
  ctx.save(); ctx.font = font;
  const m = ctx.measureText(word).width;
  ctx.restore();
  const pad = Math.ceil(size * 0.2);
  const W = Math.ceil(m) + pad * 2;
  const H = Math.ceil(size * 1.6);
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const o = off.getContext('2d');
  if (!o) return;
  o.font = font; o.direction = 'ltr'; o.textAlign = 'center'; o.textBaseline = 'middle';
  o.fillStyle = fill;
  o.fillText(word, W / 2, H / 2 + size * 0.08);

  const step = 2;
  for (let x = 0; x < W; x += step) {
    const mid = x + step / 2 - W / 2;
    const phi = inward ? at - mid / radius : at + mid / radius;
    ctx.save();
    ctx.translate(S / 2 + radius * Math.cos(phi), S / 2 + radius * Math.sin(phi));
    ctx.rotate(inward ? phi - Math.PI / 2 : phi + Math.PI / 2);
    // +0.6px of overlap so no hairline seam shows between strips.
    ctx.drawImage(off, x, 0, step, H, -step / 2, -H / 2, step + 0.6, H);
    ctx.restore();
  }
}

/**
 * Style «الإطار»: a band in the chosen colour along the edge of the picture's circle, solid
 * around the badge and fading to nothing at both ends — the kind of frame members already
 * know from other networks. The badge sits in its middle; «MOSLIM» on one side of it and
 * «LEADER» on the other, curved along the band, in reading order.
 */
function drawRibbon(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, color: string) {
  const a = BADGE_ANGLE;
  const outer = S / 2;
  const band = S * RIBBON_BAND;
  const inner = outer - band;
  const mid = outer - band / 2;
  const [r, g, b] = hexToRgb(color);

  // The band: a conic gradient centred on the badge, opaque near it, gone at ±SPREAD.
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, outer, 0, Math.PI * 2);
  ctx.arc(S / 2, S / 2, inner, 0, Math.PI * 2, true);
  ctx.closePath();
  const solid = RIBBON_SOLID / RIBBON_SPREAD;
  const stopsAt = (t: number) => (Math.PI + t * RIBBON_SPREAD) / (2 * Math.PI); // t in [-1, 1]
  if (typeof ctx.createConicGradient === 'function') {
    const gr = ctx.createConicGradient(a - Math.PI, S / 2, S / 2);
    const c = (al: number) => `rgba(${r},${g},${b},${al})`;
    gr.addColorStop(0, c(0));
    gr.addColorStop(stopsAt(-1), c(0));
    gr.addColorStop(stopsAt(-solid), c(1));
    gr.addColorStop(stopsAt(solid), c(1));
    gr.addColorStop(stopsAt(1), c(0));
    gr.addColorStop(1, c(0));
    ctx.fillStyle = gr;
    ctx.fill();
  } else {
    // Old browsers without conic gradients: fill short wedges with a falling opacity.
    ctx.clip();
    const n = 120;
    for (let i = 0; i < n; i++) {
      const t0 = -1 + (2 * i) / n, t1 = -1 + (2 * (i + 1)) / n;
      const tm = Math.abs((t0 + t1) / 2);
      const al = tm <= solid ? 1 : Math.max(0, 1 - (tm - solid) / (1 - solid));
      ctx.beginPath(); ctx.moveTo(S / 2, S / 2);
      ctx.arc(S / 2, S / 2, outer, a + t0 * RIBBON_SPREAD, a + t1 * RIBBON_SPREAD + 0.004);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${b},${al})`;
      ctx.fill();
    }
  }
  ctx.restore();

  // The badge, centred on the band and pulled in just enough to stay inside the circle.
  const d = S * RIBBON_BADGE;
  const dist = outer - d / 2 - S * 0.012;
  drawSeal(ctx, logo, S / 2 + dist * Math.cos(a), S / 2 + dist * Math.sin(a), d, color);

  // The two words, in English, read left → right. Lower half: letters' tops face the centre
  // and left→right runs toward the SMALLER angle, so «MOSLIM» (read first) sits on the
  // larger-angle side. Upper half: the baseline faces the centre and it is the reverse.
  const inward = Math.sin(a) > 0;
  const size = band * 0.54;
  const text = isLight(color) ? '#1a1a2e' : '#FFFFFF';
  const gap = d / 2 + S * 0.02;
  ctx.save(); ctx.font = WORD_FONT(size);
  const w1 = ctx.measureText('MOSLIM').width, w2 = ctx.measureText('LEADER').width;
  ctx.restore();
  const first = (gap + w1 / 2) / mid, second = (gap + w2 / 2) / mid;
  drawArcWord(ctx, 'MOSLIM', inward ? a + first : a - first, mid, size, text, inward);
  drawArcWord(ctx, 'LEADER', inward ? a - second : a + second, mid, size, text, inward);
}

export default function BadgeStudio({ signedIn, shareUrl, rewardPoints }: {
  signedIn: boolean;
  /** The member's own invite link (/r/<code>); the plain page link when there is none. */
  shareUrl: string | null;
  rewardPoints: number;
}) {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const tx = (ar: string, en: string) => (isEn ? en : ar);
  const { addToast } = useToast();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<Frame>({ zoom: 1, x: 0, y: 0 });
  const [color, setColor] = useState(BADGE_COLORS[0].hex);
  const [style, setStyle] = useState<Style>('ribbon');
  const [fontReady, setFontReady] = useState(0);
  const [round, setRound] = useState(true);
  const [busy, setBusy] = useState(false);
  const [readySrc, setReadySrc] = useState<string | null>(null);
  // The finished picture, kept ready: Web Share must be called inside the tap, and making
  // the JPEG first can outlast the tap's permission to share.
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);

  const pageUrl = shareUrl || 'https://moslimleader.com/badge';
  const postText = tx(
    `أنا جزء من مجتمع مسلم ليدر، مجتمع النبلاء 🌟، وضعت البادج على صورتي بكل فخر.\nمجتمع يربّي أبناءنا على القيم والنبل والأخلاق.\nاعمل البادج من الرابط التالي:\n${pageUrl}`,
    `I'm part of the Moslim Leader community, the community of the noble 🌟, and I'm proud to wear its badge on my picture.\nA community raising our children on values, nobility and good character.\nGet your badge here:\n${pageUrl}`,
  );

  useEffect(() => {
    loadImage(LOGO_SRC).then(setLogo).catch(() => setLogo(null));
    // The frame's words are drawn on a canvas, which does not wait for web fonts: redraw
    // once the font is in.
    document.fonts?.load?.('bold 40px Georgia').then(() => setFontReady(n => n + 1)).catch(() => {});
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
    if (style === 'ribbon') drawRibbon(ctx, logo, color);
    else drawBadge(ctx, logo, color);

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
  }, [photo, frame, logo, color, style, fontReady]);

  // ── Choosing a photo ──
  const pickReady = async (src: string) => {
    try {
      const img = await loadImage(src);
      setPhoto(img);
      setFrame({ zoom: 1, x: 0, y: 0 });
      setReadySrc(src);
    } catch {
      addToast(tx('تعذّر فتح الصورة، حاول مرة أخرى.', 'Could not open the picture, try again.'), 'error');
    }
  };
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
      setReadySrc(null);
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

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="bg-[#F6F3EC] text-[#1a1a2e] min-h-screen">
      <section className="bg-[#1a1a2e] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-28 sm:pt-36 pb-10 sm:pb-14">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-bold text-[#F5C518]">
            <Icon name="badge" size={14} /> {tx('بفخر الانتساب', 'Proud to belong')}
          </p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black leading-tight">{tx('بادج مسلم ليدر على صورتك', 'The Moslim Leader badge on your picture')}</h1>
          <p className="mt-3 max-w-2xl text-white/80 leading-relaxed">
            {tx('ارفع صورتك، اختر شكل البادج ولونه، وحمّلها لتستخدمها في أي مكان.',
              'Add your picture, choose the badge style and colour, and download it to use anywhere.')}
          </p>
          <ol className="mt-6 flex flex-wrap gap-2 text-sm">
            {[tx('ارفع صورتك', 'Add your picture'), tx('اضبطها واختر الشكل واللون', 'Frame it, pick style and colour'), tx('حمّلها وشاركها', 'Download and share')].map((s, i) => (
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
                <p className="mt-4 text-xs font-bold text-[#1a1a2e]/60">{tx('أو اختاري صورة جاهزة', 'Or choose a ready picture')}</p>
                <ul className="mt-2 grid grid-cols-5 gap-2">
                  {READY_PICTURES.map((r, i) => (
                    <li key={r.src}>
                      <button type="button" onClick={() => pickReady(r.src)} aria-pressed={readySrc === r.src}
                        aria-label={tx(`صورة جاهزة ${i + 1}`, `Ready picture ${i + 1}`)}
                        className={`block w-full aspect-square rounded-full overflow-hidden border-2 transition ${readySrc === r.src ? 'border-[#F5C518] ring-2 ring-[#1a1a2e]' : 'border-transparent hover:border-[#1a1a2e]/30'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-[#1a1a2e]/60 leading-relaxed">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  {tx('صورتك لا تُرفع لأي مكان — كل شيء يتم على جهازك.', 'Your picture is not uploaded anywhere — everything happens on your device.')}
                </p>
              </div>

              <div className="rounded-3xl bg-white border border-[#1a1a2e]/5 p-5">
                <h2 className="font-black text-lg">{tx('٢. البادج', '2. The badge')}</h2>
                <p className="mt-3 text-xs font-bold text-[#1a1a2e]/60">{tx('الشكل', 'Style')}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([{ id: 'ribbon', ar: 'إطار مع الاسم', en: 'Frame with name' }, { id: 'badge', ar: 'الشارة فقط', en: 'Badge only' }] as const).map(o => (
                    <button key={o.id} type="button" onClick={() => setStyle(o.id)} aria-pressed={style === o.id}
                      className={`rounded-2xl border px-3 py-2.5 text-sm font-bold transition ${style === o.id ? 'border-[#1a1a2e] ring-2 ring-[#F5C518]' : 'border-[#1a1a2e]/10 hover:border-[#1a1a2e]/30'}`}>
                      {isEn ? o.en : o.ar}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs font-bold text-[#1a1a2e]/60">{tx('اللون', 'Colour')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {BADGE_COLORS.map(c => (
                    <button key={c.hex} type="button" onClick={() => setColor(c.hex)} aria-pressed={color === c.hex}
                      title={isEn ? c.en : c.ar} aria-label={isEn ? c.en : c.ar}
                      className={`w-9 h-9 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1a2e] ${color === c.hex ? 'ring-2 ring-offset-2 ring-[#1a1a2e] scale-110' : 'hover:scale-105'}`}
                      style={{ background: c.hex, borderColor: isLight(c.hex) ? 'rgba(26,26,46,.25)' : 'transparent' }} />
                  ))}
                  <label className="relative w-9 h-9 rounded-full overflow-hidden border border-[#1a1a2e]/20 cursor-pointer" title={tx('لون آخر', 'Another colour')}
                    style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={tx('اختر لوناً آخر', 'Pick another colour')} />
                  </label>
                  <span className="text-xs font-bold text-[#1a1a2e]/60">{BADGE_COLORS.find(c => c.hex.toLowerCase() === color.toLowerCase())?.[isEn ? 'en' : 'ar'] ?? <span dir="ltr">{color.toUpperCase()}</span>}</span>
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
                  {shareUrl && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-[#F5C518]/90">
                      <Icon name="link" size={14} className="mt-0.5 shrink-0" />
                      {tx(`الرابط ده خاص بيك: كل صديق يسجّل منه ويستلم أول طلب له، تكسب ${rewardPoints} نقطة.`,
                        `This link is yours: for every friend who signs up through it and receives a first order, you earn ${rewardPoints} points.`)}
                    </p>
                  )}
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
