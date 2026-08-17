'use client';
import { useEffect, useState, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function useTareeqInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed (standalone mode)?
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    // Use previously captured prompt if available
    if (deferredPrompt) setCanInstall(true);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      setCanInstall(false);
      setInstalled(true);
    }
  }, []);

  return { canInstall, installed, install };
}

export default function TareeqPWA() {
  useEffect(() => {
    // Swap manifest to Tareeq-specific one
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const original = link?.href ?? '';
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = '/tareeq.webmanifest';

    // Register service worker + listen for updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/tareeq-sw.js', { scope: '/tareeq' }).catch(() => {});

      // When a new SW takes control, reload to get fresh assets
      let prevController = navigator.serviceWorker.controller;
      const onControllerChange = () => {
        if (prevController) {
          // A new SW replaced the old one → reload for fresh JS/CSS
          window.location.reload();
        }
        prevController = navigator.serviceWorker.controller;
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        const l = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (l) l.href = original || '/site.webmanifest';
      };
    }

    return () => {
      const l = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (l) l.href = original || '/site.webmanifest';
    };
  }, []);

  return null;
}

// Standalone install button — used inside TareeqSidebar and mobile banner
export function TareeqInstallButton({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { isRtl } = useLang();
  const { canInstall, installed, install } = useTareeqInstall();

  if (installed || !canInstall) return null;

  if (variant === 'compact') {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition active:scale-95"
        style={{ background: '#0a1020', color: 'var(--tr-gold)', border: '1px solid rgba(196,154,58,0.30)' }}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {isRtl ? 'حمّل التطبيق' : 'Install App'}
      </button>
    );
  }

  return (
    <button
      onClick={install}
      className="w-full flex items-center justify-between gap-3 text-white px-4 py-3.5 rounded-2xl transition active:scale-[0.98] shadow-sm"
      style={{ background: '#0a1020', border: '1px solid rgba(196,154,58,0.25)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-xl overflow-hidden shrink-0" style={{ background: '#0f1f3d' }}>
          <img src="/Tareeq-small.png" alt="" className="w-full h-full object-cover" />
        </span>
        <div className="text-start min-w-0">
          <p className="font-black text-sm">{isRtl ? 'حمّل تطبيق طريق' : 'Install Tareeq'}</p>
          <p className="text-[11px] truncate" style={{ color: 'var(--tr-gold-dim)' }}>{isRtl ? 'يشتغل بدون نت' : 'Works offline'}</p>
        </div>
      </div>
      <div className="shrink-0 rounded-full p-1.5" style={{ background: 'var(--tr-gold)' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      </div>
    </button>
  );
}

// ── Accent: yellow 80% + magenta 20% ──────────────────────────────────────
// rgb(255, 179, 89) → warm amber-rose
const ACCENT        = '#FFB359';
const ACCENT_LIGHT  = '#FFCB8A';
const ACCENT_GLOW   = 'rgba(255,100,200,0.18)';

export function TareeqInstallBanner() {
  const { isRtl } = useLang();
  const { canInstall, installed, install } = useTareeqInstall();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible]     = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('tareeq-install-dismissed')) { setDismissed(true); return; }
    // Small delay so it doesn't flash on first paint
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!canInstall || installed || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem('tareeq-install-dismissed', '1');
    setDismissed(true);
  }

  const features = isRtl
    ? [{ i: '⚡', t: 'يعمل بدون إنترنت' }, { i: '🔔', t: 'إشعارات فورية' }, { i: '✦', t: 'تجربة تطبيق أصلي' }]
    : [{ i: '⚡', t: 'Works offline' },    { i: '🔔', t: 'Instant notifications' }, { i: '✦', t: 'Native app feel' }];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-5"
      style={{
        background: 'rgba(0,0,0,0.70)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.35s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={dismiss}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #111827 0%, #0c1221 60%, #0e1528 100%)',
          border: `1.5px solid rgba(255,179,89,0.22)`,
          borderRadius: 28,
          padding: '32px 28px 26px',
          maxWidth: 340,
          width: '100%',
          boxShadow: `0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,100,200,0.08), 0 0 60px ${ACCENT_GLOW}`,
          position: 'relative',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
          transition: 'transform 0.35s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute', top: 14, insetInlineEnd: 14,
            width: 30, height: 30, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)',
            border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1,
            transition: 'background 0.15s',
          }}
        >×</button>

        {/* Logo + title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 22, overflow: 'hidden',
            boxShadow: `0 0 0 2px rgba(255,179,89,0.30), 0 8px 28px rgba(0,0,0,0.5), 0 0 30px ${ACCENT_GLOW}`,
          }}>
            <img src="/Tareeq-big.png" alt="طريق" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 900, fontSize: 22, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              {isRtl ? 'طريق' : 'Tareeq'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.5, margin: 0 }}>
              {isRtl ? 'أضفه لشاشتك الرئيسية' : 'Add to your home screen'}
            </p>
          </div>
        </div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 26, padding: '0 4px' }}>
          {features.map(({ i, t }) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.52)', fontSize: 13 }}>
              <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0, color: ACCENT_LIGHT }}>{i}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>

        {/* Install CTA */}
        <button
          onClick={install}
          style={{
            width: '100%', fontWeight: 800, fontSize: 15,
            padding: '13px 0', borderRadius: 16,
            background: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_LIGHT} 50%, ${ACCENT} 100%)`,
            color: '#0a0c14',
            letterSpacing: '0.03em',
            boxShadow: `0 6px 28px rgba(255,140,60,0.40), 0 0 16px ${ACCENT_GLOW}`,
            border: 'none', cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        >
          {isRtl ? '✦ تثبيت التطبيق' : '✦ Install App'}
        </button>

        {/* Later */}
        <button
          onClick={dismiss}
          style={{
            display: 'block', width: '100%', textAlign: 'center',
            marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.25)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          }}
        >
          {isRtl ? 'لاحقاً' : 'Maybe later'}
        </button>
      </div>
    </div>
  );
}
