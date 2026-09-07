'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Names what an icon-only button does — on hover with a mouse, on long-press with a
 * finger.
 *
 * Icon-only controls in the action bar (save, save-offline, options, share) gave the user
 * no way to find out what they did short of pressing them. `title` covers the desktop case
 * but touch devices never show it, which is most of Tareeq's traffic.
 *
 * The bubble is portaled and fixed-positioned so a rounded / overflow-hidden card ancestor
 * can't clip it — the same reason ShareDropdown is a portal.
 *
 * Wrap the button, don't replace it:
 *   <TareeqTip label="حفظ للقراءة بدون إنترنت"><button …/></TareeqTip>
 */
export default function TareeqTip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A long-press is a request to READ the label, not to activate the button. The click
  // that touchend would otherwise deliver is swallowed once.
  const swallowClick = useRef(false);

  const place = useCallback(() => {
    const host = hostRef.current;
    const bubble = bubbleRef.current;
    if (!host || !bubble) return;
    const MARGIN = 6;
    const a = host.getBoundingClientRect();
    if (a.width === 0 && a.height === 0) return; // hidden breakpoint variant
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    let left = a.left + a.width / 2 - bw / 2;
    left = Math.min(Math.max(left, MARGIN), window.innerWidth - bw - MARGIN);
    let top = a.top - MARGIN - bh;
    if (top < MARGIN) top = a.bottom + MARGIN; // flip under when there's no room above
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // Follow the trigger rather than close — the feed scrolls under the finger constantly.
    let raf = 0;
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, place]);

  useEffect(() => () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }, []);

  const scheduleHide = useCallback((ms: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { setOpen(false); setPos(null); }, ms);
  }, []);

  return (
    <>
      <span
        ref={hostRef}
        className={className}
        style={{ display: 'inline-flex', position: 'relative' }}
        // Mouse only: a touch also emits pointerenter, which would pop the bubble on every tap.
        onPointerEnter={e => { if (e.pointerType === 'mouse') setOpen(true); }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') { setOpen(false); setPos(null); } }}
        onTouchStart={() => {
          swallowClick.current = false;
          cancelPress();
          pressTimer.current = setTimeout(() => {
            swallowClick.current = true;
            setOpen(true);
            try { navigator.vibrate?.(15); } catch { /* unsupported */ }
            scheduleHide(1800);
          }, 450);
        }}
        onTouchMove={cancelPress}
        onTouchEnd={cancelPress}
        onTouchCancel={() => { cancelPress(); setOpen(false); setPos(null); }}
        onClickCapture={e => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </span>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={bubbleRef}
          role="tooltip"
          className="fixed z-[1000] px-2.5 py-1.5 rounded-lg text-[11px] font-semibold pointer-events-none whitespace-nowrap"
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            visibility: pos ? 'visible' : 'hidden',
            background: 'var(--tr-text-primary)',
            color: 'var(--tr-surface)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            maxWidth: 'min(80vw, 260px)',
          }}
        >
          {label}
        </div>,
        document.body,
      )}
    </>
  );
}
