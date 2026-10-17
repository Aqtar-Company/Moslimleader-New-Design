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
export default function TareeqVideo(props: React.VideoHTMLAttributes<HTMLVideoElement> & {
  /**
   * How the picture fills its box. `contain` (default) letterboxes and never distorts —
   * what a player must do, in the card and above all in fullscreen. `cover` crops to fill,
   * for the small square attachment tiles only.
   */
  fit?: 'contain' | 'cover';
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  // True from the first play() onwards — see the `controls` note on the element.
  const [started, setStarted] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  /** Within reach of the screen. Until then nothing is fetched — see the preload note. */
  const [near, setNear] = useState(false);
  /** Playback stopped for good: the automatic recoveries were spent, or the file failed. */
  const [failed, setFailed] = useState(false);
  /** Waiting for data for long enough that the reader deserves to be told. */
  const [slow, setSlow] = useState(false);
  const recoveriesRef = useRef(0);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { style, className, onPlay, onPause, onEnded, onLoadedMetadata, fit, ...rest } = props;
  // Callers that already say `object-cover` in their className (the inbox/group tiles) get
  // cover without having to change; everyone else gets contain.
  const objectFit: 'contain' | 'cover' = fit ?? (className?.includes('object-cover') ? 'cover' : 'contain');

  // `autoPlay` videos are already in motion; do not cover them with a button.
  useEffect(() => {
    if (props.autoPlay) { setPlaying(true); setStarted(true); }
  }, [props.autoPlay]);

  /*
   * ## Why a video could «load for ever»
   *
   * Three things, all fixed here:
   *
   * 1. **Every video in the feed was fetching at once.** Each card mounted with
   *    `preload="metadata"`, so a feed page with eight videos opened eight downloads before
   *    anyone pressed anything, and the one the reader actually wanted queued behind the
   *    other seven on a phone's connection. Now nothing is fetched until the player is
   *    within ~one screen of the viewport.
   * 2. **A video kept downloading after it scrolled away.** Playing, then scrolling on, left
   *    it running off-screen, taking the bandwidth the next one needed. It now pauses when
   *    it leaves the screen, like every feed does.
   * 3. **A stall was never recovered.** Mobile networks drop a long download half-way
   *    (a Wi-Fi→4G hand-over, a carrier NAT reset). The element then sits in `waiting`
   *    indefinitely, spinner and all — it does not retry by itself and fires no error. A
   *    watchdog now notices that the clock has not moved for 12 seconds, reopens the file
   *    at the same second, and only after two failed reopenings shows a retry button.
   */
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) setNear(true); },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      const v = ref.current;
      // Fullscreen moves the video out of its box's geometry; never pause that.
      if (!v || document.fullscreenElement || (v as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }).webkitDisplayingFullscreen) return;
      if (entries.every(e => !e.isIntersecting) && !v.paused) v.pause();
    }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => () => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
  }, []);

  const clearStall = () => {
    if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    if (slowTimerRef.current) { clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }
    setSlow(false);
  };

  /** Reopen the file and continue from where it stopped. */
  const reopen = (autoplay: boolean) => {
    const v = ref.current;
    if (!v) return;
    const at = v.currentTime || 0;
    const resume = () => {
      v.removeEventListener('loadedmetadata', resume);
      try { if (at > 0) v.currentTime = at; } catch { /* not seekable yet */ }
      if (autoplay) void v.play().catch(() => {});
    };
    v.addEventListener('loadedmetadata', resume);
    v.load();
  };

  const armStallWatch = () => {
    const v = ref.current;
    if (!v || v.paused || stallTimerRef.current) return;
    const t0 = v.currentTime;
    slowTimerRef.current = setTimeout(() => setSlow(true), 4000);
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null;
      const cur = ref.current;
      if (!cur || cur.paused || cur.currentTime !== t0) { clearStall(); return; }
      if (recoveriesRef.current < 2) {
        recoveriesRef.current += 1;
        clearStall();
        reopen(true);
      } else {
        clearStall();
        setFailed(true);
      }
    }, 12_000);
  };

  const retry = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    recoveriesRef.current = 0;
    setFailed(false);
    setStarted(true);
    reopen(true);
  };

  const start = (e: React.SyntheticEvent) => {
    // A card wraps its media in click handlers that open the post. Starting a video is
    // not "open the post".
    e.stopPropagation();
    e.preventDefault();
    // Hand over to the native controls from here on, whether or not play() succeeds —
    // if it is refused (autoplay policy) the user needs them to start it themselves.
    setStarted(true);
    void ref.current?.play().catch(() => { /* autoplay policy — the user can use the controls */ });
  };

  return (
    // Sized by the caller's `style`/`className` exactly as the bare element was, so no
    // existing layout moves. The overlay is absolutely positioned inside.
    <div ref={boxRef} className={`tr-video${className ? ` ${className}` : ''}`} style={{ position: 'relative', display: 'block', lineHeight: 0, overflow: 'hidden', ...style }}>
      {/* iOS Safari paints its own large play glyph in the centre of a paused video with
          controls — on top of ours, so the phone showed two. Desktop browsers do not. The
          WebKit pseudo-element is the only handle on it; hiding it leaves one button, ours,
          on every device. Tapping the video itself still starts playback. */}
      <style>{`.tr-video video::-webkit-media-controls-start-playback-button{display:none!important;-webkit-appearance:none}`}</style>
      <video
        ref={ref}
        {...rest}
        // The native controls are withheld until the first play. WebKit (Safari AND Chrome
        // on iOS — same engine) draws its own large play glyph in the centre of any paused
        // video that has `controls`, on top of ours, and on iOS 17+ the pseudo-element rule
        // above no longer reaches it: the phone showed two buttons. With no `controls`
        // attribute WebKit draws nothing at all, so ours is the only one. The first tap
        // flips `controls` on and starts playback; from then on the browser owns the UI
        // (scrubbing, volume, fullscreen, and its own play/pause when paused).
        controls={rest.controls ? started : undefined}
        // Metadata must load even without controls, or the duration badge never appears —
        // but only once the player is near the screen (see the note above). A video that
        // was started is always allowed to load, whatever the observer says.
        preload={near || started ? (rest.preload ?? 'metadata') : 'none'}
        // `max-height: inherit` takes the wrapper's COMPUTED max-height — whether it came
        // from a `style` prop or a Tailwind `max-h-*` class — so the constraint the caller
        // put on "the video" still lands on the video. Without it a tall portrait clip
        // would size to its intrinsic height and overflow the card; the wrapper's
        // `overflow: hidden` is the second line of defence, not the first.
        // `object-fit` is set EXPLICITLY. A previous version used `inherit`, meaning to pick
        // up the tiles' `object-cover` — but the wrapper div has no object-fit of its own, so
        // the inherited value was the initial `fill`, which overrode the browser's default
        // `contain` for <video>. Result: the picture was STRETCHED to the box, and in
        // fullscreen — where the box is the whole screen — visibly distorted.
        style={{ width: '100%', height: '100%', maxHeight: 'inherit', objectFit, display: 'block', background: '#000', borderRadius: 'inherit' }}
        onPlay={e => { setPlaying(true); setStarted(true); setFailed(false); onPlay?.(e); }}
        onPause={e => { setPlaying(false); clearStall(); onPause?.(e); }}
        onEnded={e => { setPlaying(false); clearStall(); onEnded?.(e); }}
        onWaiting={armStallWatch}
        onStalled={armStallWatch}
        onPlaying={() => { clearStall(); }}
        // Not resetting the recovery count here on purpose: the seek after a reopen fires
        // `timeupdate` too, and resetting then would retry every 12 seconds for ever and
        // never show the button. Two silent reopenings per player, then the reader decides.
        onTimeUpdate={() => { if (stallTimerRef.current) clearStall(); }}
        onError={() => {
          // A network error mid-file is worth one silent reopen; a file the browser cannot
          // decode at all is not, and gets the retry button straight away.
          const code = ref.current?.error?.code;
          if (started && code === 2 /* MEDIA_ERR_NETWORK */ && recoveriesRef.current < 2) {
            recoveriesRef.current += 1;
            reopen(true);
          } else if (started) {
            setFailed(true);
          }
        }}
        onLoadedMetadata={e => {
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) && d > 0 ? d : null);
          onLoadedMetadata?.(e);
        }}
      />

      {started && (slow || failed) && (
        <div
          style={{ position: 'absolute', top: 10, insetInlineStart: 10, insetInlineEnd: 10, display: 'flex', justifyContent: 'center', pointerEvents: 'none', lineHeight: 1.4 }}
        >
          {failed ? (
            <button
              type="button"
              onClick={retry}
              style={{ pointerEvents: 'auto', padding: '6px 14px', borderRadius: 999, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,255,255,0.35)', cursor: 'pointer' }}
            >
              تعذّر إكمال التحميل — إعادة المحاولة ↻
            </button>
          ) : (
            <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, fontWeight: 600 }}>
              الاتصال بطيء — جارٍ التحميل…
            </span>
          )}
        </div>
      )}

      {/* Only where there are native controls to hand over to. A tile with no `controls`
          is a thumbnail, not a player: giving it a play button starts a video that can
          then never be paused. Once started, the overlay never returns — the native
          controls are visible by then and show their own play button when paused. */}
      {!playing && !started && rest.controls && (
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
              //
              // ONE dimension only. Setting both to a percentage resolved them against
              // DIFFERENT axes — 40% of the width and 40% of the height — so on any video
              // that is not square the circle came out an ellipse, and `aspectRatio` could
              // not correct it because both sides were already stated. The height is left
              // to the aspect ratio, and `maxHeight` keeps it inside a very short player.
              width: 'min(72px, 22%)',
              aspectRatio: '1',
              maxHeight: '44%',
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
