'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';

interface Props {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isRtl: boolean;
  onClose: () => void;
}

const GOLD = '#d4a853';
const BG   = '#0a1020';

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

export default function TareeqQRModal({ userId, name, avatarUrl, isRtl, onClose }: Props) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted,    setMounted]    = useState(false);
  const [qrReady,    setQrReady]    = useState(false);
  const [brandedBlob, setBrandedBlob] = useState<Blob | null>(null);
  const [brandedUrl,  setBrandedUrl]  = useState<string | null>(null);
  const [sharing,    setSharing]    = useState(false);
  const profileUrl = `https://moslimleader.com/tareeq/u/${userId}`;

  useEffect(() => { setMounted(true); }, []);

  // Cleanup object URL on unmount
  useEffect(() => () => { if (brandedUrl) URL.revokeObjectURL(brandedUrl); }, [brandedUrl]);

  // Esc to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Generate QR code once canvas is in DOM
  useEffect(() => {
    if (!mounted || !qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, profileUrl, {
      width: 240, margin: 2,
      color: { dark: BG, light: '#ffffff' },
    }).then(() => setQrReady(true)).catch(() => {});
  }, [mounted, profileUrl]);

  // Build branded card once QR is ready
  const generateBrandedCard = useCallback(async (): Promise<Blob | null> => {
    const qr = qrCanvasRef.current;
    if (!qr) return null;

    const W = 560, H = 780;
    const card = document.createElement('canvas');
    card.width = W; card.height = H;
    const ctx = card.getContext('2d');
    if (!ctx) return null;

    // ── Background ──
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Subtle gold glow top-right
    const grd = ctx.createRadialGradient(W, 0, 0, W, 0, 220);
    grd.addColorStop(0, 'rgba(212,168,83,0.13)');
    grd.addColorStop(1, 'rgba(212,168,83,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // ── Tareeq logo image ──
    const LOGO = 80;
    const LX = W / 2 - LOGO / 2;
    const LY = 30;
    try {
      const logoImg = new Image();
      await new Promise<void>((res, rej) => {
        logoImg.onload = () => res();
        logoImg.onerror = () => rej();
        logoImg.src = '/Tareeq-big.png';
      });
      // Rounded-square clip
      ctx.save();
      ctx.beginPath();
      const R = 18;
      ctx.moveTo(LX + R, LY);
      ctx.lineTo(LX + LOGO - R, LY);
      ctx.quadraticCurveTo(LX + LOGO, LY, LX + LOGO, LY + R);
      ctx.lineTo(LX + LOGO, LY + LOGO - R);
      ctx.quadraticCurveTo(LX + LOGO, LY + LOGO, LX + LOGO - R, LY + LOGO);
      ctx.lineTo(LX + R, LY + LOGO);
      ctx.quadraticCurveTo(LX, LY + LOGO, LX, LY + LOGO - R);
      ctx.lineTo(LX, LY + R);
      ctx.quadraticCurveTo(LX, LY, LX + R, LY);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logoImg, LX, LY, LOGO, LOGO);
      ctx.restore();
    } catch {
      // Fallback: gold star
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 54px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', W / 2, LY + LOGO / 2);
    }

    // ── "طريق" text below logo ──
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('طريق', W / 2, LY + LOGO + 28);

    // Thin gold divider line
    ctx.strokeStyle = 'rgba(212,168,83,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, LY + LOGO + 52);
    ctx.lineTo(W / 2 + 60, LY + LOGO + 52);
    ctx.stroke();

    // ── Avatar ──
    const AVY = 232, AVR = 52;

    ctx.beginPath();
    ctx.arc(W / 2, AVY, AVR + 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W / 2, AVY, AVR, 0, Math.PI * 2);
    ctx.fillStyle = '#1a2540';
    ctx.fill();

    let imgLoaded = false;
    if (avatarUrl) {
      try {
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej();
          img.src = avatarUrl;
        });
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, AVY, AVR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, W / 2 - AVR, AVY - AVR, AVR * 2, AVR * 2);
        ctx.restore();
        imgLoaded = true;
      } catch { /* fallback */ }
    }
    if (!imgLoaded) {
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 38px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name[0] ?? '?', W / 2, AVY);
    }

    // ── Name ──
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let displayName = name;
    while (ctx.measureText(displayName).width > W - 80 && displayName.length > 1) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== name) displayName += '…';
    ctx.fillText(displayName, W / 2, 304);

    // ── QR white card ──
    const QR = 256, QX = (W - QR) / 2, QY = 340, PAD = 16;
    ctx.fillStyle = '#ffffff';
    fillRoundRect(ctx, QX - PAD, QY - PAD, QR + PAD * 2, QR + PAD * 2, 16);
    ctx.drawImage(qr, QX, QY, QR, QR);

    // ── Footer ──
    // "مجتمع مسلم ليدر"
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('مجتمع مسلم ليدر', W / 2, H - 44);

    // "moslimleader.com"
    ctx.fillStyle = 'rgba(212,168,83,0.6)';
    ctx.font = '12px monospace';
    ctx.fillText('moslimleader.com', W / 2, H - 24);

    return new Promise(resolve => card.toBlob(resolve, 'image/png'));
  }, [avatarUrl, name]);

  useEffect(() => {
    if (!qrReady) return;
    generateBrandedCard().then(blob => {
      if (!blob) return;
      setBrandedBlob(blob);
      setBrandedUrl(URL.createObjectURL(blob));
    });
  }, [qrReady, generateBrandedCard]);

  function handleDownload() {
    if (!brandedUrl) return;
    const a = document.createElement('a');
    a.href = brandedUrl;
    a.download = `tareeq-${name}.png`;
    a.click();
  }

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      if (!navigator.share) return;
      // Try file share (branded card) first
      if (brandedBlob) {
        const file = new File([brandedBlob], `tareeq-${name}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: name });
          return;
        }
      }
      // Fallback: share URL only
      await navigator.share({ title: name, url: profileUrl });
    } catch { /* user dismissed */ }
    finally { setSharing(false); }
  }

  if (!mounted) return null;

  const ready = !!brandedUrl;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--tr-surface)', borderRadius: 20, padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 320, width: '100%' }}
      >
        {/* Avatar */}
        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'var(--tr-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 0 2.5px ${GOLD}` }}>
          {avatarUrl
            ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--tr-gold)' }}>{name[0]}</span>}
        </div>

        <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--tr-text-primary)', margin: 0, textAlign: 'center' }}>{name}</p>

        {/* QR canvas */}
        <canvas ref={qrCanvasRef} style={{ borderRadius: 12, border: '1px solid var(--tr-border-soft)', display: 'block' }} />

        {/* Generating indicator */}
        {qrReady && !ready && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tr-text-muted)' }}>
            <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            {isRtl ? 'جاري التجهيز...' : 'Preparing...'}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={handleDownload}
            disabled={!ready}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', fontWeight: 600, fontSize: 14, border: '1px solid var(--tr-border-soft)', cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.45 }}
          >
            {isRtl ? 'حفظ' : 'Save'}
          </button>
          <button
            onClick={handleShare}
            disabled={!ready || sharing}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--tr-gold)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: ready && !sharing ? 'pointer' : 'default', opacity: ready && !sharing ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {sharing
              ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isRtl ? '...' : '...'}</>
              : (isRtl ? 'مشاركة' : 'Share')}
          </button>
        </div>

        <button onClick={onClose} style={{ color: 'var(--tr-text-muted)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', paddingTop: 2 }}>
          {isRtl ? 'إغلاق' : 'Close'}
        </button>
      </div>
    </div>,
    document.body
  );
}
