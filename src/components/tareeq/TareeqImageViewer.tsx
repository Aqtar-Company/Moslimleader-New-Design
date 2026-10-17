'use client';

import { useEffect, useRef, useState } from 'react';
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
  images,
  startIndex = 0,
  alt,
  isRtl,
  onClose,
}: {
  /** A single image. Ignored when `images` has more than one entry. */
  src?: string;
  /**
   * Every image of the post, so the reader can move between them. The viewer used to
   * take one `src` and nothing else, and the post page and sheet passed only the first
   * picture — so in a post of two images the second could not be seen at all.
   */
  images?: string[];
  startIndex?: number;
  alt?: string | null;
  isRtl: boolean;
  onClose: () => void;
}) {
  const list = images && images.length ? images : src ? [src] : [];
  const [index, setIndex] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, list.length - 1)));
  const many = list.length > 1;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number; multi: boolean } | null>(null);

  const go = (delta: number) => {
    if (!many) return;
    setIndex(i => (i + delta + list.length) % list.length);
    // A tall page scrolled to its bottom must not leave the NEXT one opened half-way down.
    scrollerRef.current?.scrollTo({ top: 0 });
  };
  const goRef = useRef(go);
  goRef.current = go;

  // Escape closes it, the arrow keys move between images (mirrored in RTL, where "next"
  // lies to the left), and the page behind must not scroll while it is open — otherwise
  // dismissing returns the reader to a different place than they left.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goRef.current(isRtl ? 1 : -1);
      else if (e.key === 'ArrowRight') goRef.current(isRtl ? -1 : 1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, isRtl]);

  if (typeof document === 'undefined' || list.length === 0) return null;
  const current = list[index];

  const arrow = (side: 'prev' | 'next'): React.CSSProperties => ({
    position: 'fixed',
    top: '50%',
    transform: 'translateY(-50%)',
    // "next" sits at the inline END: the left in Arabic, the right in English.
    ...(side === 'next' ? { insetInlineEnd: 10 } : { insetInlineStart: 10 }),
    zIndex: VIEWER_Z + 1,
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.16)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    fontSize: 24,
    lineHeight: 1,
    cursor: 'pointer',
    backdropFilter: 'blur(6px)',
  });

  return createPortal(
    <div
      ref={scrollerRef}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      // Swipe between images. One finger only: two fingers are a pinch-zoom, and a mostly
      // vertical drag is scrolling a tall page — neither may change the picture.
      onTouchStart={e => {
        const t = e.touches[0];
        touchRef.current = { x: t.clientX, y: t.clientY, multi: e.touches.length > 1 };
      }}
      onTouchMove={e => { if (touchRef.current && e.touches.length > 1) touchRef.current.multi = true; }}
      onTouchEnd={e => {
        const start = touchRef.current;
        touchRef.current = null;
        if (!start || start.multi || !many) return;
        // Zoomed in: the finger is panning the picture, not asking for the next one.
        if (window.visualViewport && window.visualViewport.scale > 1.05) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        // Dragging toward the inline START brings in the next image from the END.
        const forward = isRtl ? dx > 0 : dx < 0;
        go(forward ? 1 : -1);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: VIEWER_Z,
        background: '#000',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        // `safe` matters: with a plain `center`, a portrait image taller than the viewport
        // is centred so that its TOP overflows the scroll container's start edge, and that
        // overflow is unreachable — the user can scroll down but never back up to the top
        // of the picture. `safe center` falls back to start-alignment the moment the item
        // does not fit. A browser that does not know the keyword drops the whole
        // declaration and start-aligns anyway, which is the behaviour we want.
        alignItems: 'safe center',
        justifyContent: 'safe center',
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

      {many && (
        <>
          <button type="button" aria-label={isRtl ? 'الصورة السابقة' : 'Previous image'} style={arrow('prev')}
            onClick={e => { e.stopPropagation(); go(-1); }}>
            {isRtl ? '›' : '‹'}
          </button>
          <button type="button" aria-label={isRtl ? 'الصورة التالية' : 'Next image'} style={arrow('next')}
            onClick={e => { e.stopPropagation(); go(1); }}>
            {isRtl ? '‹' : '›'}
          </button>
          <span
            dir="ltr"
            style={{
              position: 'fixed',
              top: 'max(20px, env(safe-area-inset-top))',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: VIEWER_Z + 1,
              padding: '4px 12px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none',
            }}
          >
            {index + 1} / {list.length}
          </span>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current}
        src={current}
        alt={index === 0 ? (alt ?? '') : ''}
        // Stops a tap ON the image from closing it — panning a zoomed page would otherwise
        // dismiss the viewer on every finger-up.
        onClick={e => e.stopPropagation()}
        // No `margin: auto` — auto margins in a flex container absorb the free space and
        // reintroduce exactly the unreachable-top overflow that `safe center` avoids.
        style={{ width: '100%', height: 'auto', display: 'block', flexShrink: 0 }}
      />
    </div>,
    document.body,
  );
}
