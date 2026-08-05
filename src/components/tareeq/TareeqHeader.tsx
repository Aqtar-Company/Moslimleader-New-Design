'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

interface Props { onCreateClick: () => void; }

export default function TareeqHeader({ onCreateClick }: Props) {
  const { isRtl } = useLang();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a1f1a]/95 backdrop-blur-sm border-b border-emerald-900/40 h-14 flex items-center px-4 print:hidden">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-2">

        {/* Start — ML logo → back to site */}
        <Link
          href="/"
          className="flex items-center gap-2 group min-w-[44px] min-h-[44px]"
          title={isRtl ? 'العودة إلى مسلم ليدر' : 'Back to Moslim Leader'}
        >
          <img
            src="/ml-logo-new.png"
            alt="مسلم ليدر"
            className="w-8 h-8 object-contain opacity-90 group-hover:opacity-100 transition shrink-0"
          />
          <span className="hidden sm:block text-xs text-emerald-400/70 group-hover:text-emerald-300 font-semibold transition">
            {isRtl ? 'مسلم ليدر' : 'Moslim Leader'}
          </span>
        </Link>

        {/* Center — Tareeq identity */}
        <Link href="/tareeq" className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <span className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
            <img src="/tareeq-logo- circle.png" alt="طريق" className="w-full h-full object-cover" />
          </span>
          <span className="font-black text-white text-base tracking-wide">
            {isRtl ? 'طريق' : 'Tareeq'}
          </span>
        </Link>

        {/* End — create button with icon + label always visible */}
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-black text-xs px-3 py-2 rounded-full transition min-h-[36px]"
        >
          <span className="w-4 h-4 rounded-sm overflow-hidden shrink-0 flex items-center justify-center bg-emerald-600">
            <img src="/tareeq-logo- small.png" alt="" className="w-full h-full object-cover" />
          </span>
          <span>{isRtl ? 'اترك علامة' : 'Leave a Mark'}</span>
        </button>

      </div>
    </header>
  );
}
