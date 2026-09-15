'use client';

import { useEffect, useState } from 'react';

/**
 * An avatar `<img>` that degrades to the person's initial when the picture cannot load.
 *
 * A bare `<img alt={name}>` whose source is broken renders the browser's broken-image icon
 * and the alt text — the member's NAME — spilling out of a 32px circle. That is what every
 * card showed for a member whose photo was stored on a path production never served. The
 * source of that is fixed (`src/lib/r2.ts`), but a URL can still break: a deleted object, a
 * legacy disk path in an old row, a CDN blip. The fallback is the same initial-in-a-circle
 * the card already draws when there is no photo at all.
 *
 * `className` and `style` are applied to whichever element renders, so size, border and
 * shape come out identical either way.
 */
export default function TareeqAvatarImg({
  src,
  name,
  className,
  style,
  fallbackStyle,
}: {
  src: string | null | undefined;
  name: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  /** Extra styles for the initial circle only (background/colour). */
  fallbackStyle?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  // A new src gets a fresh chance — the member may have just uploaded a working photo.
  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    return (
      <span
        className={`${className ?? ''} inline-flex items-center justify-center font-black select-none`}
        style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', lineHeight: 1, ...style, ...fallbackStyle }}
        aria-label={name ?? undefined}
        role="img"
      >
        {(name ?? '?').trim().charAt(0) || '?'}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? ''}
      className={className}
      style={style}
      onError={() => setFailed(true)}
      // Nothing to read while the image is loading — the alt text flashing inside a small
      // circle before the picture arrives is the very artefact this component removes.
      draggable={false}
    />
  );
}
