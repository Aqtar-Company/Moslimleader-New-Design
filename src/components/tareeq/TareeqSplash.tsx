'use client';
import { useState, useEffect } from 'react';

export default function TareeqSplash() {
  // Start as 'gone' — SSR and first client render both produce null.
  // useEffect sets to 'in' only on the first visit (no sessionStorage key).
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
      {/* Ambient glow behind logo */}
      <div style={{
        position: 'absolute',
        width: 280, height: 280,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,168,83,0.20) 0%, transparent 70%)',
        filter: 'blur(30px)',
      }} />

      {/* Logo */}
      <div
        className="relative w-28 h-28 rounded-3xl overflow-hidden mb-7"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(212,168,83,0.25)' }}
      >
        <img src="/Tareeq-big.png" alt="طريق" className="w-full h-full object-cover" />
      </div>

      {/* Arabic typography from brand asset */}
      <img
        src="/Tareeq-Typo.png"
        alt="طريق TAREEQ"
        className="w-44 object-contain mb-3"
        style={{ filter: 'brightness(1.1)' }}
      />

      {/* Taglines */}
      <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em' }}>
        Free Social App for Moslim Leader Community
      </p>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)', direction: 'rtl' }}>
        تطبيق تواصل اجتماعي مجاني لأعضاء مجتمع مسلم ليدر
      </p>

      {/* ML logo — gold wordmark, visible at bottom */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <img src="/logo gold.png" alt="Moslim Leader" className="h-11 object-contain opacity-70" />
      </div>
    </div>
  );
}
