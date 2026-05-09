'use client';

import { useEffect, useRef, useState } from 'react';
import { fmt } from '@/lib/format';

// Report primitives shared by /admin/valuation and /admin/accounting.
// Both pages render long, mixed-density financial reports; consolidating
// the layout pieces here keeps them visually identical and lets us
// evolve the styling in one place.

export function Section({
  icon,
  title,
  subtitle,
  children,
  breakBefore,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  breakBefore?: boolean;
}) {
  return (
    <section className={`space-y-4 valuation-section ${breakBefore ? 'valuation-page-break' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[#F5C518] to-[#e6a200] rounded-xl flex items-center justify-center text-xl shrink-0">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-black text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// Boxy "asset / liability" card used inside Section grids.
export function KPI({
  label,
  value,
  sub,
  tone,
  hint,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'ok' | 'bad';
  hint?: string;
}) {
  return (
    <div className={`bg-white border rounded-2xl p-4 relative ${tone === 'bad' ? 'border-red-300' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex-1">{label}</p>
        {hint && <Tooltip text={hint} />}
      </div>
      <p className={`text-xl font-black mt-1 ${tone === 'bad' ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// Slimmer KPI used in the financial-performance row, with a green/red
// tone applied directly to the value (vs KPI which only colours the
// border for "bad").
export function FinKPI({
  label,
  value,
  sub,
  hint,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  hint?: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const cls = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 font-bold tracking-widest flex items-center gap-1">
        {label}
        {hint && <Tooltip text={hint} />}
      </p>
      <p className={`text-xl font-black mt-1 ${cls}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// Click-to-toggle info icon. Mobile-friendly: tap-outside closes.
export function Tooltip({ text, dark }: { text: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <span ref={ref} className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center transition shrink-0 ${dark ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
        aria-label="شرح"
      >i</button>
      {open && (
        <span className="absolute z-30 top-full left-0 mt-1.5 w-56 bg-[#1a1a2e] text-white text-[10px] leading-relaxed font-normal rounded-lg p-2.5 shadow-xl pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

// Re-export `fmt` so single import point for primitives + formatters.
export { fmt };
