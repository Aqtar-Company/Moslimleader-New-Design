'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * An image, full screen, with nothing around it.
 *
 * The card and the post sheet both show images inside a bounded, rounded, cropped box —
 * correct for a feed. But a large share of طريق's posts are a written page photographed,
 * and for those the box IS the problem: "fits inside the card" is exactly the state in
 * which the text cannot be read.
 *
 * Two decisions that make this actually usable, rather than just bigger:
 *
 *  - The image is rendered at full width with `height: auto` and the backdrop scrolls. It
 *    is NOT scaled to fit the screen. Fitting a page of Arabic text to a phone screen
 *    makes it unreadable, and overflow is what lets the browser's own pinch-zoom and
 *    panning work on it.
 *  - Portalled to `document.body` and `position: fixed` with no padding or max-width, so
 *    no rounded, clipping or transformed ancestor can contain it — which is what happens
 *    when a viewer is rendered inside the card it was opened from.
 *  - Above EVERYTHING. The first version sat at z-index 300 and opened *behind* the post
 *    sheet that launched it: that sheet is at 9998/9999 and other overlays in Tareeq go to
 *    10000. Being portalled is not enough on its own — a sibling of `body` with a lower
 *    z-index still loses. This is deliberately the highest number in the app, because a
 *    viewer that opens behind the thing you opened it from is worse than no viewer.
 */

/** Higher than every other overlay in Tareeq (sheets 9998–9999, menus 10000). */
const VIEWER_Z = 100000;
export default function TareeqImageViewer({
  src,
  alt,
  isRtl,
  onClose,
}: {
  src: string;
  alt?: string | null;
  isRtl: boolean;
  onClose: () => void;
}) {
  // Escape closes it, and the page behind must not scroll while it is open — otherwise
  // dismissing returns the reader to a different place than they left.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: VIEWER_Z,
        background: '#000',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        aria-label={isRtl ? 'إغلاق' : 'Close'}
        style={{
          position: 'fixed',
          top: 'max(14px, env(safe-area-inset-top))',
          insetInlineEnd: 14,
          zIndex: VIEWER_Z + 1,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.14)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.28)',
          fontSize: 22,
          lineHeight: 1,
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
        }}
      >
        ×
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ''}
        // Stops a tap ON the image from closing it — panning a zoomed page would otherwise
        // dismiss the viewer on every finger-up.
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', height: 'auto', display: 'block', margin: 'auto' }}
      />
    </div>,
    document.body,
  );
}
