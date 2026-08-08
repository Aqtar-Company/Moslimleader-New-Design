'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';

interface Props { onClose: () => void; }

export default function TareeqLandingModal({ onClose }: Props) {
  const router = useRouter();
  const { isRtl } = useLang();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function enter() {
    onClose();
    router.push('/tareeq');
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(7,9,15,0.85)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden flex flex-col items-center text-center py-12 px-8"
        style={{
          background: 'linear-gradient(160deg, #07090f 0%, #0f1428 60%, #16254a 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 end-4 w-8 h-8 flex items-center justify-center rounded-full transition"
          style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)' }}
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 200,
          background: 'radial-gradient(circle, rgba(212,168,83,0.22) 0%, transparent 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div
          className="relative w-24 h-24 rounded-2xl overflow-hidden mb-6"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.10), 0 16px 48px rgba(212,168,83,0.30)' }}
        >
          <img src="/Tareeq-big.png" alt="طريق" className="w-full h-full object-cover" />
        </div>

        {/* Arabic typography */}
        <img src="/Tareeq-Typo.png" alt="طريق TAREEQ" className="w-36 object-contain mb-2" style={{ filter: 'brightness(1.1)' }} />

        {/* Tagline */}
        <p className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em' }}>
          {isRtl ? 'تطبيق التواصل الاجتماعي' : 'The Social App'}
        </p>
        <p className="text-xs leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.30)' }}>
          {isRtl
            ? 'تطبيق تواصل اجتماعي مجاني لأعضاء مجتمع مسلم ليدر'
            : 'Free social app for Moslim Leader community members'}
        </p>

        {/* CTA */}
        <button
          onClick={enter}
          className="w-full py-3.5 rounded-2xl font-black text-sm transition active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #a07830 0%, #d4a853 60%, #f0c060 100%)',
            color: '#fff',
            boxShadow: '0 6px 24px rgba(212,168,83,0.50)',
          }}
        >
          <span style={{ marginInlineEnd: 6 }}>
            <svg className="inline w-4 h-4 mb-0.5" fill="#fff" viewBox="0 0 24 24">
              <path d="M12 3l1.4 5.6L18.4 5.6l-3 4.4L21 12l-5.6 1.4 2.4 5.4-4.8-2.8L12 21l-1.4-5.6-5.4 2.4 2.8-4.8L3 12l5.6-1.4L6.2 5l4.4 3z" />
            </svg>
          </span>
          {isRtl ? 'ادخل طريق' : 'Enter Tareeq'}
        </button>

        {/* ML branding at bottom */}
        <div className="mt-8 flex items-center gap-2 opacity-25">
          <img src="/ml-logo-new.png" alt="Moslim Leader" className="h-5 object-contain" />
        </div>
      </div>
    </div>
  );
}
