// Brand-coloured loading spinner used by every admin page during
// initial data fetch. Replaces the ~10 inline `border-[#F5C518]
// border-t-transparent rounded-full animate-spin` blocks scattered
// across /admin. Default is `md` centred in a 40-tall flex box; pass
// `inline` to skip the wrapper (for use inside buttons / pills).
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md';
  inline?: boolean;
}

export default function Spinner({ size = 'md', inline = false }: SpinnerProps) {
  const dim = size === 'sm' ? 'w-4 h-4 border-2' : 'w-7 h-7 border-4';
  const dot = (
    <div
      className={`${dim} border-[#F5C518] border-t-transparent rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
  if (inline) return dot;
  return <div className="flex items-center justify-center h-40">{dot}</div>;
}
