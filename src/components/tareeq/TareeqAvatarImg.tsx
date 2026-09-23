'use client';

import { useEffect, useState } from 'react';
import { blurPxForSize, blurStyle } from '@/lib/tareeq-gender';
import { useTareeqViewer } from '@/context/TareeqViewerContext';

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
  blur,
  ownerGender,
  ownerId,
  sizePx,
}: {
  src: string | null | undefined;
  name: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  /** Extra styles for the initial circle only (background/colour). */
  fallbackStyle?: React.CSSProperties;
  /**
   * Veil this picture — a woman's avatar seen by a man. Enough blur to lose the features
   * and keep the shape, decided in one place (`BLUR_AVATAR_PX`).
   *
   * It is a CSS filter, so it is modesty and not protection: the original is what was
   * sent, and developer tools reveal it. Never tell a member their photo is protected by
   * this — see the note in `src/lib/tareeq-gender.ts`.
   *
   * Leave it undefined and the component decides from `ownerGender` and the viewer. Pass
   * it explicitly only to force one way — a preview of your own photo, say.
   */
  blur?: boolean;
  /** The gender of the person in the picture. Undefined is treated as "not a man". */
  ownerGender?: string | null;
  /** Their id, so nobody's own picture is ever veiled to them. */
  ownerId?: string | null;
  /**
   * Rendered width in px, when the caller knows it. The blur scales with it — the radius
   * that hides a 96px face turns a 28px one into a smear.
   */
  sizePx?: number;
}) {
  const viewer = useTareeqViewer();
  // The decision is the context's, not the caller's: an avatar is rendered in a dozen
  // places and a boolean computed at each of them is a boolean forgotten at one of them.
  const veil = blur ?? viewer.blurFor(ownerGender, ownerId);
  // Fall back to reading it off the Tailwind size class when no number was passed — `w-8`
  // is 2rem, and a wrong guess only picks a slightly different radius.
  const guessed = sizePx ?? (() => {
    const m = /(?:^|\s)w-(\d+(?:\.\d+)?)(?:$|\s)/.exec(className ?? '');
    return m ? Number(m[1]) * 4 : undefined;
  })();
  const [failed, setFailed] = useState(false);
  // A new src gets a fresh chance — the member may have just uploaded a working photo.
  useEffect(() => { setFailed(false); }, [src]);

  // The initial-in-a-circle carries no likeness, so it is never veiled.
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
  if (veil) {
    // The scale in blurStyle pushes the softened edge past the frame, so the wrapper has to
    // clip it — otherwise the blur bleeds a pale halo outside the circle.
    return (
      <span className={className} style={{ ...style, overflow: 'hidden', display: 'inline-block', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          aria-hidden
          onError={() => setFailed(true)}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...blurStyle(blurPxForSize(guessed)) }}
        />
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
