'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { MEDIA_REACTIONS } from '@/lib/free-media-shared';
import Icon from './Icon';

/**
 * Reactions on a media item — طريق's five (ألهمني، شكراً، أتفق، يارب، ماشاء الله), the same
 * faces and the same gesture: tap to open, tap a face to choose, the same face again to take
 * it back. These five are emoji on purpose — they ARE the reactions, as in طريق.
 *
 * `layout="stack"` is the reels column (icon over count, on dark video); `inline` is the row
 * on an item's page.
 */
export type Summary = { counts: Record<string, number>; total: number; mine: string | null };

export default function MediaReactions({ mediaId, initial, isEn, layout = 'inline', tone = 'light' }: {
  mediaId: number;
  initial: Summary;
  isEn: boolean;
  layout?: 'inline' | 'stack';
  tone?: 'light' | 'dark';
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [s, setS] = useState<Summary>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setS(initial); }, [initial]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [open]);

  const mine = MEDIA_REACTIONS.find(r => r.type === s.mine) ?? null;
  const top = Object.entries(s.counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([t]) => MEDIA_REACTIONS.find(r => r.type === t)?.emoji).filter(Boolean);

  const choose = async (type: string) => {
    setOpen(false);
    if (!user) {
      addToast(isEn ? 'Sign in to react' : 'سجّل الدخول للتفاعل', 'info');
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (busy) return;
    // Optimistic: the face changes under the finger, the server confirms after.
    const prev = s;
    const takingBack = s.mine === type;
    const counts = { ...s.counts };
    if (s.mine) counts[s.mine] = Math.max(0, (counts[s.mine] ?? 1) - 1);
    if (!takingBack) counts[type] = (counts[type] ?? 0) + 1;
    setS({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0), mine: takingBack ? null : type });
    setBusy(true);
    try {
      const res = await fetch(`/api/media/${mediaId}/reactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
      });
      if (res.ok) setS(await res.json());
      else setS(prev);
    } catch { setS(prev); }
    finally { setBusy(false); }
  };

  const dark = tone === 'dark';
  const picker = open && (
    <div
      role="menu"
      className={`absolute z-30 flex gap-1 p-1.5 rounded-full shadow-2xl border ${dark ? 'bg-black/80 border-white/15 backdrop-blur' : 'bg-white border-gray-200'} ${layout === 'stack' ? 'bottom-0 end-full me-2' : 'bottom-full mb-2 start-0'}`}
    >
      {MEDIA_REACTIONS.map(r => (
        <button
          key={r.type}
          role="menuitem"
          type="button"
          onClick={() => void choose(r.type)}
          title={isEn ? r.labelEn : r.labelAr}
          aria-label={isEn ? r.labelEn : r.labelAr}
          className={`w-11 h-11 rounded-full flex flex-col items-center justify-center transition hover:scale-110 ${s.mine === r.type ? 'ring-2' : ''}`}
          style={{ background: s.mine === r.type ? `${r.color}26` : 'transparent', ...(s.mine === r.type ? { boxShadow: `0 0 0 2px ${r.color}` } : {}) }}
        >
          <span className="text-2xl leading-none">{r.emoji}</span>
        </button>
      ))}
    </div>
  );

  if (layout === 'stack') {
    return (
      <div ref={boxRef} className="relative flex flex-col items-center gap-1">
        {picker}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={isEn ? 'React' : 'تفاعل'}
          aria-expanded={open}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]"
        >
          {mine ? <span className="text-2xl leading-none">{mine.emoji}</span> : <Icon name="smile" size={26} />}
        </button>
        <span className="text-white text-xs font-bold drop-shadow tabular-nums">{s.total || ''}</span>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative inline-flex items-center gap-2">
      {picker}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518] ${dark ? 'bg-white/10 text-white' : 'bg-[#EFEBE2] text-[#1a1a2e] hover:bg-[#E5DFD2]'}`}
        style={mine ? { color: mine.color } : undefined}
      >
        {mine ? <span className="text-lg leading-none">{mine.emoji}</span> : <Icon name="smile" size={18} />}
        {mine ? (isEn ? mine.labelEn : mine.labelAr) : (isEn ? 'React' : 'تفاعل')}
      </button>
      {s.total > 0 && (
        <span className={`inline-flex items-center gap-1 text-sm ${dark ? 'text-white/80' : 'text-gray-500'}`}>
          <span className="tracking-[-3px]">{top.join('')}</span>
          <span className="font-bold tabular-nums ms-1">{s.total}</span>
        </span>
      )}
    </div>
  );
}
