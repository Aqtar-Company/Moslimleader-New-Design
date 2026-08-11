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
    <div
      className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:hidden z-30 rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, #0d1a35 0%, #0a1228 100%)',
        border: '1.5px solid rgba(212,168,83,0.55)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.12), 0 0 24px rgba(212,168,83,0.10)',
        padding: '14px 14px 14px 14px',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
          <img src="/Tareeq-big.png" alt="" className="w-full h-full object-cover" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-black text-base" style={{ color: '#ffffff' }}>
            {isRtl ? 'حمّل تطبيق طريق' : 'Install Tareeq'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(212,168,83,0.80)' }}>
            {isRtl ? 'أضفه للشاشة الرئيسية — يعمل بدون إنترنت' : 'Add to home screen · Works offline'}
          </p>
        </div>
        <button onClick={dismiss} className="shrink-0 p-1.5 rounded-full transition" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <button
        onClick={install}
        className="mt-3 w-full font-bold text-sm py-2.5 rounded-xl transition active:scale-95"
        style={{
          background: 'linear-gradient(90deg, #c49a3a 0%, #e0bc5a 50%, #c49a3a 100%)',
          color: '#0a0e1a',
          letterSpacing: '0.02em',
          boxShadow: '0 4px 16px rgba(196,154,58,0.35)',
        }}
      >
        {isRtl ? '✦ تثبيت التطبيق' : '✦ Install App'}
      </button>
    </div>
  );
}
