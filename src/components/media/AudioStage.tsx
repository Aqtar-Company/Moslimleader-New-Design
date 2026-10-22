'use client';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { formatDuration } from '@/lib/free-media-shared';
import Icon from './Icon';

/**
 * The audio player, in the SoundCloud shape: the cover large, the waveform laid over its
 * lower part, a big play button. An audio item used to look like a small video with a
 * native control strip; this makes it unmistakably something to LISTEN to.
 *
 * - The waveform is the file's real loudness, measured once at upload (`waveform`). Items
 *   without one get even, plainly decorative bars — still a working seek bar.
 * - The waveform IS the seek bar: tap or drag anywhere on it; arrow keys move 5 seconds.
 *   It carries `role="slider"` with its values, so a screen reader hears a position.
 * - The <audio> element is the parent's (forwarded ref): autoplay, the sleep timer's fade
 *   and the lock-screen controls all keep working on it unchanged.
 */
type Props = {
  src: string;
  coverUrl: string | null;
  title: string;
  label: string | null;
  waveform: number[] | null;
  durationSec: number | null;
  isEn: boolean;
  onEnded: () => void;
  onPlay: () => void;
};

const BARS = 120;

const AudioStage = forwardRef<HTMLAudioElement, Props>(function AudioStage(
  { src, coverUrl, title, label, waveform, durationSec, isEn, onEnded, onPlay }, ref,
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useImperativeHandle(ref, () => audioRef.current as HTMLAudioElement);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number>(durationSec ?? 0);
  const [loading, setLoading] = useState(false);
  const waveRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  /*
   * How many bars fit. A fixed 120 bars with 2px gaps needs 240px of gaps alone; on a phone
   * the bar is narrower than that, every bar was squeezed to zero width, and what showed
   * was a few stray lines with wide holes between them. So the count follows the width:
   * one bar per 4px (2px bar + 2px gap), at most BARS.
   */
  const [count, setCount] = useState(BARS);
  useEffect(() => {
    const el = waveRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setCount(Math.max(24, Math.min(BARS, Math.floor(e.contentRect.width / 4)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bars = useMemo(() => {
    if (waveform && waveform.length) {
      // Resample what was stored to the bars drawn here, keeping each stretch's PEAK so a
      // loud moment is not lost between two samples.
      return Array.from({ length: count }, (_, i) => {
        const from = Math.floor((i / count) * waveform.length);
        const to = Math.max(from + 1, Math.floor(((i + 1) / count) * waveform.length));
        return Math.max(...waveform.slice(from, to)) || 10;
      });
    }
    return Array.from({ length: count }, (_, i) => 30 + ((i * 37) % 23)); // even, plainly decorative
  }, [waveform, count]);

  useEffect(() => { setTime(0); setPlaying(false); setDuration(durationSec ?? 0); }, [src, durationSec]);

  const progress = duration > 0 ? Math.min(1, time / duration) : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { setLoading(true); void a.play().catch(() => setLoading(false)); }
    else a.pause();
  };

  /** Position from a pointer. Time runs left→right in both languages — the project's rule
   *  for every progress bar (CLAUDE.md), and it matches the 0:00 … end labels under it. */
  const seekTo = (clientX: number) => {
    const el = waveRef.current;
    const a = audioRef.current;
    if (!el || !a || !duration) return;
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    a.currentTime = f * duration;
    setTime(a.currentTime);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1a1a2e] aspect-[4/3] sm:aspect-[21/9]">
      {/* The cover, large. Without one, the kind's tile. */}
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" decoding="async" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a2140] via-[#3a2f5c] to-[#1a1a2e] flex items-center justify-center text-[#F5C518]/40">
          <Icon name="audio" size={96} strokeWidth={1.2} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" aria-hidden />

      {/* The whole picture is a play/pause surface: tapping the cover anywhere — not only
          the button — starts or pauses the song, as one expects of a big player. It sits
          under the title and the bar, which let clicks through or handle their own. Not a
          second focusable control: the yellow button below is the keyboard's. */}
      <div className="absolute inset-0 cursor-pointer" onClick={toggle} aria-hidden />

      {/* Title, top — clicks pass through to the cover. */}
      <div className="absolute top-0 inset-x-0 p-4 sm:p-6 pointer-events-none">
        {label && <p className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-black/55 text-[#F5C518] mb-1.5">{label}</p>}
        <p className="text-white text-base sm:text-2xl font-black leading-snug drop-shadow line-clamp-2">
          <span className="bg-black/45 box-decoration-clone px-1.5 rounded">{title}</span>
        </p>
      </div>

      {/* Bottom bar: play on the LEFT, then the waveform — the seek bar — and the times.
          Left to right in both languages, like the bar itself (the progress-bar rule). */}
      <div dir="ltr" className="absolute bottom-0 inset-x-0 p-4 sm:p-6 flex items-end gap-3 sm:gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? (isEn ? 'Pause' : 'إيقاف مؤقت') : (isEn ? 'Play' : 'تشغيل')}
          className="shrink-0 mb-6 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#F5C518] text-[#1a1a2e] flex items-center justify-center shadow-xl hover:scale-105 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {loading && !playing ? <Icon name="loader" size={26} spin /> : <Icon name={playing ? 'pause' : 'play'} size={26} className={playing ? '' : 'translate-x-[1px]'} />}
        </button>
        <div className="flex-1 min-w-0">
        <div
          ref={waveRef}
          role="slider"
          tabIndex={0}
          aria-label={isEn ? 'Position' : 'موضع التشغيل'}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatDuration(time) ?? '0:00'} / ${formatDuration(duration) ?? '0:00'}`}
          onPointerDown={e => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); seekTo(e.clientX); }}
          onPointerMove={e => { if (dragging.current) seekTo(e.clientX); }}
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
          onKeyDown={e => {
            const a = audioRef.current;
            if (!a) return;
            const fwd = e.key === 'ArrowRight';
            const bwd = e.key === 'ArrowLeft';
            if (fwd || bwd) { e.preventDefault(); a.currentTime = Math.max(0, Math.min(duration, a.currentTime + (fwd ? 5 : -5))); setTime(a.currentTime); }
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
          }}
          className="relative h-14 sm:h-20 flex items-end gap-[2px] cursor-pointer touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F5C518] rounded"
        >
          {bars.map((h, i) => {
            const played = (i + 0.5) / bars.length <= progress;
            return (
              <span
                key={i}
                className={`flex-1 rounded-t-sm transition-colors ${played ? 'bg-[#F5C518]' : 'bg-white/55'}`}
                style={{ height: `${Math.max(6, h)}%` }}
                aria-hidden
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs font-bold text-white/85 tabular-nums">
          <span>{formatDuration(time) ?? '0:00'}</span>
          <span>{formatDuration(duration) ?? '--:--'}</span>
        </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDuration(d); }}
        onTimeUpdate={e => { if (!dragging.current) setTime(e.currentTarget.currentTime); }}
        onPlay={() => { setPlaying(true); onPlay(); }}
        onPlaying={() => setLoading(false)}
        onPause={() => { setPlaying(false); setLoading(false); }}
        onWaiting={() => setLoading(true)}
        onEnded={() => { setPlaying(false); onEnded(); }}
        className="hidden"
      />
    </div>
  );
});

export default AudioStage;
