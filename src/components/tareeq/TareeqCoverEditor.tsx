'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  isRtl: boolean;
  onFile: (blob: Blob) => void;
  onCancel: () => void;
}

// Output dimensions for the cropped cover
const CROP_W = 1200;
const CROP_H = 400;

export default function TareeqCoverEditor({ isRtl, onFile, onCancel }: Props) {
  const [phase, setPhase] = useState<'picker' | 'crop'>('picker');
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  const [mounted, setMounted] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const prevClient = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => () => { if (imgSrc) URL.revokeObjectURL(imgSrc); }, [imgSrc]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  function handleFile(file: File) {
    setImgSrc(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setPosX(50);
    setPosY(50);
    setPhase('crop');
  }

  const onPD = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    prevClient.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPM = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !imgRef.current || !wrapRef.current) return;
    const dx = e.clientX - prevClient.current.x;
    const dy = e.clientY - prevClient.current.y;
    prevClient.current = { x: e.clientX, y: e.clientY };

    const img = imgRef.current;
    const wrap = wrapRef.current;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const ww = wrap.clientWidth, wh = wrap.clientHeight;
    if (!nw || !nh) return;

    const srcRatio = nw / nh;
    const wrapRatio = ww / wh;

    if (srcRatio > wrapRatio) {
      // Image wider — horizontal excess
      const displayedW = nh * srcRatio * (ww / ww); // = ww * (nw/nh) / (ww/wh)
      const excessX = (nw / nh) * wh - ww;
      if (excessX > 1) {
        const delta = ((-dx) / excessX) * 100;
        setPosX(p => Math.min(100, Math.max(0, p + delta)));
      }
    } else {
      // Image taller — vertical excess
      const excessY = (nh / nw) * ww - wh;
      if (excessY > 1) {
        const delta = ((-dy) / excessY) * 100;
        setPosY(p => Math.min(100, Math.max(0, p + delta)));
      }
    }
  }, []);

  const onPU = useCallback(() => { dragging.current = false; }, []);

  function save() {
    const img = imgRef.current;
    if (!img || !imgSrc) return;
    const canvas = document.createElement('canvas');
    canvas.width = CROP_W;
    canvas.height = CROP_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nw = img.naturalWidth, nh = img.naturalHeight;
    const targetRatio = CROP_W / CROP_H;
    const srcRatio = nw / nh;
    let sx = 0, sy = 0, sw = nw, sh = nh;

    if (srcRatio > targetRatio) {
      // Wider — crop sides horizontally
      sh = nh;
      sw = nh * targetRatio;
      sx = (nw - sw) * (posX / 100);
    } else {
      // Taller — crop top/bottom vertically
      sw = nw;
      sh = nw / targetRatio;
      sy = (nh - sh) * (posY / 100);
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CROP_W, CROP_H);
    canvas.toBlob(b => { if (b) onFile(b); }, 'image/jpeg', 0.88);
  }

  if (!mounted) return null;

  // ── Phase 1: Camera / Gallery picker ──────────────────────────────────
  if (phase === 'picker') {
    return createPortal(
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          dir={isRtl ? 'rtl' : 'ltr'}
          style={{ background: 'var(--tr-surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520 }}
        >
          <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--tr-text-primary)', marginBottom: 20 }}>
            {isRtl ? 'تغيير صورة الغلاف' : 'Change Cover Photo'}
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {/* Camera */}
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 0', borderRadius: 14, background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', cursor: 'pointer' }}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />
              <svg width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tr-text-secondary)' }}>{isRtl ? 'الكاميرا' : 'Camera'}</span>
            </label>

            {/* Gallery */}
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 0', borderRadius: 14, background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', cursor: 'pointer' }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />
              <svg width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tr-text-secondary)' }}>{isRtl ? 'معرض الصور' : 'Gallery'}</span>
            </label>
          </div>

          <button
            onClick={onCancel}
            style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ── Phase 2: Drag-to-reposition crop ──────────────────────────────────
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{ background: 'var(--tr-surface)', borderRadius: 20, overflow: 'hidden', maxWidth: 560, width: '100%' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--tr-border-subtle)' }}>
          <button
            onClick={onCancel}
            style={{ fontSize: 14, color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'ضبط الغلاف' : 'Adjust Cover'}
          </span>
          <button
            onClick={save}
            style={{ fontSize: 14, fontWeight: 700, color: 'var(--tr-gold)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            {isRtl ? 'حفظ' : 'Save'}
          </button>
        </div>

        {/* Crop preview — 3:1 ratio */}
        <div
          ref={wrapRef}
          style={{ position: 'relative', height: 187, overflow: 'hidden', cursor: 'grab', userSelect: 'none', background: '#000', touchAction: 'none' }}
          onPointerDown={onPD}
          onPointerMove={onPM}
          onPointerUp={onPU}
          onPointerCancel={onPU}
        >
          {imgSrc && (
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${posX}% ${posY}%`, pointerEvents: 'none', display: 'block' }}
            />
          )}
          {/* Hint overlay */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 12, pointerEvents: 'none' }}>
            <span style={{ background: 'rgba(0,0,0,0.52)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 14px', borderRadius: 20, backdropFilter: 'blur(6px)', letterSpacing: '0.02em' }}>
              {isRtl ? '✦ اسحب لضبط الموضع' : '✦ Drag to reposition'}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
