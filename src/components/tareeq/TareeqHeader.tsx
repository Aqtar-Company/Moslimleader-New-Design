'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

interface Props { onCreateClick: () => void; }

export default function TareeqHeader({ onCreateClick }: Props) {
  const { isRtl } = useLang();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a1f1a]/95 backdrop-blur-sm border-b border-emerald-900/40 h-11 flex items-center px-4 print:hidden">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-2">

        {/* Start — spacer keeps center identity truly centered */}
        <div className="w-9" />

        {/* Center — Tareeq identity */}
        <Link href="/tareeq" className="flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
          <span className="w-6 h-6 rounded-md overflow-hidden shrink-0">
            <img src="/tareeq-logo- circle.png" alt="طريق" className="w-full h-full object-cover" />
          </span>
          <span className="font-black text-white text-sm tracking-wide">
            {isRtl ? 'طريق' : 'Tareeq'}
          </span>
        </Link>

        {/* End — create button */}
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-full transition"
        >
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="hidden sm:inline">{isRtl ? 'علامة' : 'Mark'}</span>
        </button>

      </div>
    </header>
  );
}
