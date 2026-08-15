'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';

interface Props {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isRtl: boolean;
  onClose: () => void;
}

export default function TareeqQRModal({ userId, name, avatarUrl, isRtl, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const profileUrl = `https://moslimleader.com/tareeq/u/${userId}`;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, profileUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#0a1020', light: '#ffffff' },
    }).then(() => {
      setDataUrl(canvasRef.current!.toDataURL('image/png'));
    }).catch(() => {});
  }, [profileUrl]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `tareeq-${userId}.png`;
    a.click();
  }

  async function handleShare() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `tareeq-${userId}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name, url: profileUrl });
      } else if (navigator.share) {
        await navigator.share({ title: name, url: profileUrl });
      }
    } catch { /* user cancelled or not supported */ }
  }

  if (!mounted) return null;

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
        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'var(--tr-overlay)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {avatarUrl
            ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--tr-gold)' }}>{name[0]}</span>}
        </div>

        <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--tr-text-primary)', margin: 0, textAlign: 'center' }}>{name}</p>

        {/* QR canvas */}
        <canvas
          ref={canvasRef}
          style={{ borderRadius: 12, border: '1px solid var(--tr-border-soft)', display: 'block' }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={handleDownload}
            disabled={!dataUrl}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', fontWeight: 600, fontSize: 14, border: '1px solid var(--tr-border-soft)', cursor: dataUrl ? 'pointer' : 'default', opacity: dataUrl ? 1 : 0.5 }}
          >
            {isRtl ? 'حفظ' : 'Save'}
          </button>
          <button
            onClick={handleShare}
            disabled={!dataUrl}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--tr-gold)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: dataUrl ? 'pointer' : 'default', opacity: dataUrl ? 1 : 0.5 }}
          >
            {isRtl ? 'مشاركة' : 'Share'}
          </button>
        </div>

        <button
          onClick={onClose}
          style={{ color: 'var(--tr-text-muted)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', paddingTop: 2 }}
        >
          {isRtl ? 'إغلاق' : 'Close'}
        </button>
      </div>
    </div>,
    document.body
  );
}
