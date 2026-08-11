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

      {/* Logo */}
      <div
        className="relative w-20 h-20 rounded-2xl overflow-hidden mb-5"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 16px 48px rgba(212,168,83,0.25)' }}
      >
        <img src="/Tareeq-big.png" alt="طريق" className="w-full h-full object-cover" />
      </div>

      {/* Arabic typography image */}
      <img
        src="/Tareeq-Typo.png"
        alt="طريق"
        className="w-36 object-contain mb-1"
        style={{ filter: 'brightness(1.15)' }}
      />

      {/* English */}
      <span style={{
        color: 'rgba(212,168,83,0.75)',
        letterSpacing: '0.38em',
        fontSize: '0.72rem',
        fontFamily: 'inherit',
        textTransform: 'uppercase',
      }}>
        TAREEQ
      </span>

      {/* ML logo — bottom */}
      <div className="absolute bottom-10 flex flex-col items-center">
        <img src="/logo gold.png" alt="Moslim Leader" className="h-8 object-contain opacity-55" />
      </div>
    </div>
  );
}
