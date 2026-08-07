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

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/tareeq-sw.js', { scope: '/tareeq' }).catch(() => {});
    }

    return () => {
      // Restore original manifest when leaving Tareeq
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

// Mobile install banner — appears at bottom above the FAB
export function TareeqInstallBanner() {
  const { isRtl } = useLang();
  const { canInstall, installed, install } = useTareeqInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('tareeq-install-dismissed')) setDismissed(true);
  }, []);

  if (!canInstall || installed || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem('tareeq-install-dismissed', '1');
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:hidden z-30 rounded-2xl shadow-2xl shadow-black/40 p-3 flex items-center gap-3" style={{ background: '#0a1020', border: '1px solid rgba(196,154,58,0.25)' }}>
      <span className="w-10 h-10 rounded-xl overflow-hidden shrink-0" style={{ background: '#0f1f3d' }}>
        <img src="/Tareeq-small.png" alt="" className="w-full h-full object-cover" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-black text-sm">{isRtl ? 'حمّل تطبيق طريق' : 'Install Tareeq'}</p>
        <p className="text-[11px]" style={{ color: 'var(--tr-gold-dim)' }}>{isRtl ? 'أضفه للشاشة الرئيسية' : 'Add to home screen'}</p>
      </div>
      <button
        onClick={install}
        className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition"
        style={{ background: 'var(--tr-gold)', color: '#000' }}
      >
        {isRtl ? 'تثبيت' : 'Install'}
      </button>
      <button onClick={dismiss} className="shrink-0 text-emerald-600 hover:text-emerald-400 transition p-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
