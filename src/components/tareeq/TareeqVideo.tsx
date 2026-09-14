'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The shared `<video>` for Tareeq — every feed card, share card and post page uses it.
 *
 * ## What it adds over a bare element
 *
 * 1. **A large centred play button while the video is not playing.** A poster frame with
 *    the browser's small native controls along the bottom reads as a PHOTO on a phone —
 *    the complaint was, precisely, "I can't tell it's a video". The button is the
 *    universal signal that it is one, and it is also the biggest tap target to start it.
 *    It comes back when the video is paused, and hides the moment playback starts so the
 *    native controls take over.
 *
 * 2. **The duration on the poster** (e.g. `2:19`), read from the element's own metadata —
 *    nothing is stored for it. Knowing how long a clip is before pressing play is the
 *    single most useful piece of information a video card can carry.
 *
 * Native `controls` are kept, deliberately. Scrubbing, volume and fullscreen are the
 * browser's job and it does them better than any re-implementation; this only covers
 * the moment BEFORE the browser is in charge.
 *
 * ## History
 *
 * It used to seek past the end on `loadedmetadata` to force the browser to work out the
 * duration of a `MediaRecorder` file, which reports `Infinity`. That fixed the scrubber
 * and broke the picture (those files have no Cues index; after a seek to the end the
 * demuxer cannot find a keyframe). The seek is gone; durations are written correctly at
 * encode time now (WebCodecs path), and `Infinity` simply shows no badge.
 */
export default function TareeqVideo(props: React.VideoHTMLAttributes<HTMLVideoElement>) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const { style, className, onPlay, onPause, onEnded, onLoadedMetadata, ...rest } = props;

  // `autoPlay` videos are already in motion; do not cover them with a button.
  useEffect(() => {
    if (props.autoPlay) setPlaying(true);
  }, [props.autoPlay]);

  const start = (e: React.SyntheticEvent) => {
    // A card wraps its media in click handlers that open the post. Starting a video is
    // not "open the post".
    e.stopPropagation();
    e.preventDefault();
    void ref.current?.play().catch(() => { /* autoplay policy — the user can use the controls */ });
  };

  return (
    // Sized by the caller's `style`/`className` exactly as the bare element was, so no
    // existing layout moves. The overlay is absolutely positioned inside.
    <div className={`tr-video${className ? ` ${className}` : ''}`} style={{ position: 'relative', display: 'block', lineHeight: 0, overflow: 'hidden', ...style }}>
      {/* iOS Safari paints its own large play glyph in the centre of a paused video with
          controls — on top of ours, so the phone showed two. Desktop browsers do not. The
          WebKit pseudo-element is the only handle on it; hiding it leaves one button, ours,
          on every device. Tapping the video itself still starts playback. */}
      <style>{`.tr-video video::-webkit-media-controls-start-playback-button{display:none!important;-webkit-appearance:none}`}</style>
      <video
        ref={ref}
        {...rest}
        // `max-height: inherit` takes the wrapper's COMPUTED max-height — whether it came
        // from a `style` prop or a Tailwind `max-h-*` class — so the constraint the caller
        // put on "the video" still lands on the video. Without it a tall portrait clip
        // would size to its intrinsic height and overflow the card; the wrapper's
        // `overflow: hidden` is the second line of defence, not the first.
        // `height`/`object-fit: inherit` too: the inbox and group attachment tiles pass
        // `h-full object-cover` and expect the video to FILL a 64px square, not sit in it
        // at 16:9 with a gap.
        style={{ width: '100%', height: '100%', maxHeight: 'inherit', objectFit: 'inherit', display: 'block', background: '#000', borderRadius: 'inherit' }}
        onPlay={e => { setPlaying(true); onPlay?.(e); }}
        onPause={e => { setPlaying(false); onPause?.(e); }}
        onEnded={e => { setPlaying(false); onEnded?.(e); }}
        onLoadedMetadata={e => {
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) && d > 0 ? d : null);
          onLoadedMetadata?.(e);
        }}
      />

      {/* Only where there are native controls to hand over to. A tile with no `controls`
          is a thumbnail, not a player: giving it a play button starts a video that can
          then never be paused. */}
      {!playing && rest.controls && (
        <>
          {/* One big target. `pointer-events` only on the button itself, so the native
              controls along the bottom stay reachable while the overlay is up. */}
          <button
            type="button"
            onClick={start}
            aria-label="تشغيل الفيديو — Play video"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              // Relative to the box on small players, capped on big ones.
              width: 'min(72px, 40%)',
              height: 'min(72px, 40%)',
              aspectRatio: '1',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.55)',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
              lineHeight: 0,
            }}
          >
            {/* Triangle nudged right by two pixels: an optically centred play glyph sits a
                little off geometric centre or it looks like it is leaning left. */}
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '42%', height: '42%', marginInlineStart: '4%' }} aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>

          {duration !== null && (
            <span
              // Top corner, clear of the native control bar, and always LTR: "2:19" is a
              // number, not a sentence, and must not flip in an RTL card.
              dir="ltr"
              style={{
                position: 'absolute',
                top: 10,
                insetInlineEnd: 10,
                padding: '3px 8px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.65)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                lineHeight: '16px',
                fontVariantNumeric: 'tabular-nums',
                pointerEvents: 'none',
              }}
            >
              {formatDuration(duration)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
