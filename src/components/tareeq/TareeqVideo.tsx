'use client';

import { useCallback, useRef } from 'react';

/**
 * A `<video>` that knows its own length.
 *
 * A file produced by `MediaRecorder` — which now includes every video Tareeq compresses in
 * the browser — carries no duration in its header. The element reports `Infinity`, so the
 * seek bar sits at the far end, the time never advances against it, and scrubbing does
 * nothing. The picture and sound are fine; only the controls are lost.
 *
 * Seeking past the end forces the browser to walk to the last cluster and work the real
 * length out. After that the element behaves normally and the controls come back.
 *
 * This lives in the PLAYER rather than in the encoder on purpose: it repairs the videos
 * already uploaded as well as the ones still to come. Writing the duration into the WebM
 * header at encode time would be the tidier fix, but it would only help future uploads and
 * needs an EBML writer to get right.
 */
export default function TareeqVideo(props: React.VideoHTMLAttributes<HTMLVideoElement>) {
  const { onLoadedMetadata, ...rest } = props;
  const fixing = useRef(false);

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const el = e.currentTarget;

      // `fixing` guards against the recursion: the seek below fires loadedmetadata again on
      // some browsers, and without it the element would seek to the end forever.
      if (!fixing.current && !isFinite(el.duration)) {
        fixing.current = true;
        const settle = () => {
          el.removeEventListener('durationchange', settle);
          // Back to the start, and only if the viewer has not already begun watching —
          // yanking someone back to zero mid-play would be worse than a broken scrubber.
          if (el.currentTime > 0 && el.paused) el.currentTime = 0;
          fixing.current = false;
        };
        el.addEventListener('durationchange', settle);
        try {
          el.currentTime = 1e101;
        } catch {
          el.removeEventListener('durationchange', settle);
          fixing.current = false;
        }
        // A file that never resolves must not leave the guard stuck on.
        setTimeout(() => {
          el.removeEventListener('durationchange', settle);
          fixing.current = false;
        }, 3000);
      }

      onLoadedMetadata?.(e);
    },
    [onLoadedMetadata],
  );

  /* eslint-disable-next-line jsx-a11y/media-has-caption */
  return <video {...rest} onLoadedMetadata={handleLoadedMetadata} />;
}
