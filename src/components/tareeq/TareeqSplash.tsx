'use client';
import { useState, useEffect } from 'react';

export default function TareeqSplash() {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('gone');

  useEffect(() => {
    if (localStorage.getItem('tareeq-splash-shown')) return;
    localStorage.setItem('tareeq-splash-shown', '1');
    setPhase('in');
    const fadeOut = setTimeout(() => setPhase('out'), 2200);
    const remove  = setTimeout(() => setPhase('gone'), 2900);
    return () => { clearTimeout(fadeOut); clearTimeout(remove); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(160deg, #07090f 0%, #0f1428 55%, #16254a 100%)',
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 0.7s ease',
        pointerEvents: phase === 'out' ? 'none' : 'auto',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        width: 240, height: 240,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,168,83,0.18) 0%, transparent 70%)',
        filter: 'blur(28px)',
      }} />

      {/* Logo — smaller */}
      <div
        className="relative w-20 h-20 rounded-2xl overflow-hidden mb-6"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 16px 48px rgba(212,168,83,0.25)' }}
      >
        <img src="/Tareeq-big.png" alt="طريق" className="w-full h-full object-cover" />
      </div>

      {/* Typography — Arabic + English */}
      <div className="flex flex-col items-center mb-5" style={{ gap: '4px' }}>
        <span style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: '2.8rem',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.03em',
          direction: 'rtl',
          lineHeight: 1,
        }}>
          طريق
        </span>
        <span style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: '0.78rem',
          fontWeight: 400,
          color: 'rgba(212,168,83,0.80)',
          letterSpacing: '0.38em',
          textTransform: 'uppercase' as const,
        }}>
          TAREEQ
        </span>
      </div>

      {/* Taglines */}
      <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.40)', letterSpacing: '0.05em' }}>
        Free Social App for Moslim Leader Community
      </p>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)', direction: 'rtl' }}>
        تطبيق تواصل اجتماعي مجاني لأعضاء مجتمع مسلم ليدر
      </p>

      {/* ML logo */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <img src="/logo gold.png" alt="Moslim Leader" className="h-11 object-contain opacity-70" />
      </div>
    </div>
  );
}
