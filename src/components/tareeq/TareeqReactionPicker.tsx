'use client';

/**
 * The platform's reaction picker — one component for posts and for comments.
 *
 * It lived inside `TareeqCard`, so only posts could open it. Comments on the post page got
 * a single star that toggled `inspired` and nothing else, while the comment API had
 * accepted the full set all along and the post SHEET already offered it. Three screens,
 * two behaviours, one of them a star that looked like a rating.
 *
 * Anything that reacts to anything imports this. A second copy would drift the same way.
 */

import { TAREEQ_REACTIONS, type TareeqReactionType } from '@/lib/tareeq-constants';

export default function TareeqReactionPicker({
  currentReaction, onReact, onClose, isRtl, dark = false, compact = false,
}: {
  currentReaction: string | null;
  onReact: (type: TareeqReactionType) => void;
  onClose: () => void;
  isRtl: boolean;
  dark?: boolean;
  /** Comment rows are dense — drops the labels and shrinks the circles. */
  compact?: boolean;
}) {
  const size = compact ? 34 : 40;
  return (
    <>
      {/* Full-screen catcher: a tap anywhere closes the picker, including on a phone
          where there is no pointer to leave. */}
      <div className="fixed inset-0 z-[49]" onClick={onClose} />
      <div
        className="absolute bottom-full start-0 z-50 flex items-end gap-1.5 mb-2"
        style={{
          background: dark ? 'rgba(12,12,12,0.72)' : 'var(--tr-surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'var(--tr-border-soft)'}`,
          borderRadius: 20,
          padding: compact ? '6px 9px' : '8px 12px',
          boxShadow: '0 8px 32px var(--tr-shadow-popup)',
          whiteSpace: 'nowrap',
        }}
        onClick={e => e.stopPropagation()}
      >
        {TAREEQ_REACTIONS.map(r => {
          const active = currentReaction === r.type;
          return (
            <button
              key={r.type}
              type="button"
              onClick={() => { onReact(r.type); onClose(); }}
              title={isRtl ? r.labelAr : r.labelEn}
              aria-label={isRtl ? r.labelAr : r.labelEn}
              className="flex flex-col items-center gap-0.5 transition-transform"
              style={{ transform: active ? 'scale(1.18) translateY(-4px)' : 'scale(1)' }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
              onPointerUp={e => (e.currentTarget.style.transform = active ? 'scale(1.18) translateY(-4px)' : 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = active ? 'scale(1.18) translateY(-4px)' : 'scale(1)')}
            >
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: size, height: size, fontSize: compact ? 17 : 20,
                  background: active ? `${r.color}22` : (dark ? 'rgba(255,255,255,0.08)' : 'var(--tr-overlay)'),
                  border: `1.5px solid ${active ? r.color + '70' : (dark ? 'rgba(255,255,255,0.14)' : 'var(--tr-border-soft)')}`,
                  boxShadow: active ? `0 0 12px ${r.color}55` : 'none',
                  transition: 'all 150ms',
                }}
              >
                {r.emoji}
              </div>
              {!compact && (
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? r.color : (dark ? 'rgba(255,255,255,0.6)' : 'var(--tr-text-muted)') }}>
                  {isRtl ? r.labelAr : r.labelEn}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
