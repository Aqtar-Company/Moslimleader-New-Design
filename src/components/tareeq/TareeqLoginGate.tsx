'use client';
import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

interface Props { onClose: () => void; }

export default function TareeqLoginGate({ onClose }: Props) {
  const { isRtl } = useLang();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'var(--tr-backdrop)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-8 max-w-sm w-full text-center"
        style={{
          background: 'var(--tr-raised)',
          border: '1px solid var(--tr-border-soft)',
          boxShadow: '0 24px 80px var(--tr-shadow-popup)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
          <span style={{ color: 'var(--tr-gold)', fontSize: 24 }}>★</span>
        </div>
        <h2 className="font-black text-xl mb-2" style={{ color: 'var(--tr-text-primary)' }}>
          {isRtl ? 'انضم إلى طريق' : 'Join Tareeq'}
        </h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--tr-text-muted)' }}>
          {isRtl
            ? 'سجّل دخولك لتترك علامتك وتهتدي بعلامات الآخرين'
            : 'Sign in to leave your mark and be guided by others'}
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="flex-1 font-bold py-3 rounded-xl text-sm transition"
            style={{
              background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))',
              color: '#fff',
            }}
          >
            {isRtl ? 'تسجيل الدخول' : 'Sign In'}
          </Link>
          <Link
            href="/login?mode=signup"
            className="flex-1 font-bold py-3 rounded-xl text-sm transition"
            style={{
              background: 'var(--tr-overlay)',
              color: 'var(--tr-text-secondary)',
              border: '1px solid var(--tr-border-soft)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tr-gold-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--tr-gold)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tr-border-soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-secondary)'; }}
          >
            {isRtl ? 'إنشاء حساب' : 'Register'}
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
