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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-5xl mb-4">⭐</div>
        <h2 className="font-black text-gray-900 text-xl mb-2">
          {isRtl ? 'انضم إلى طريق' : 'Join Tareeq'}
        </h2>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          {isRtl
            ? 'سجّل دخولك لتترك علامتك وتهتدي بعلامات الآخرين'
            : 'Sign in to leave your mark and be guided by others'}
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="flex-1 bg-[#1a1a2e] text-white font-bold py-3 rounded-xl text-sm hover:bg-gray-800 transition"
          >
            {isRtl ? 'تسجيل الدخول' : 'Sign In'}
          </Link>
          <Link
            href="/register"
            className="flex-1 border-2 border-[#1a1a2e] text-[#1a1a2e] font-bold py-3 rounded-xl text-sm hover:bg-gray-50 transition"
          >
            {isRtl ? 'إنشاء حساب' : 'Register'}
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
