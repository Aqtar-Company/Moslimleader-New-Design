/**
 * Shrink a video in the browser, before it is uploaded.
 *
 * ## Why here and not on the server
 *
 * Re-encoding on the server means ffmpeg on a box that also runs the shop and two other
 * projects, and one 250MB re-encode takes the CPU for minutes. The uploader's own device
 * already has the file and a hardware encoder; this costs the server nothing.
 *
 * ## How
 *
 * The video is played muted into a canvas scaled down to 720p, the canvas is recorded with
 * `MediaRecorder` at a capped bitrate, and the original's audio track is carried across
 * untouched. Most of the size in a phone video is resolution and bitrate — a 4K/60fps clip
 * drops by roughly an order of magnitude at 720p and 1.5 Mbps, with no visible loss at the
 * size Tareeq actually displays it.
 *
 * ## The cost, stated plainly
 *
 * This runs in REAL TIME. A three-minute video takes three minutes, because the only way
 * to feed frames to the canvas is to play them. That is a real price, and the caller must
 * show progress or it will look frozen. It is still better than uploading 250MB over
 * mobile data and being refused at the end.
 *
 * ## When it declines
 *
 * Returns null — never throws — when `MediaRecorder` or `canvas.captureStream` is missing,
 * when no supported output type exists (older Safari), or when the result came out no
 * smaller than the input, which happens with a clip that is already well compressed.
 * The caller then falls back to the plain size message. Compression is an attempt, not a
 * guarantee, and a failure here must never block a file the server would have accepted.
 */

import { writeWebmDuration } from '@/lib/webm-duration';

const TARGET_MAX_DIMENSION = 1280;
const VIDEO_BITS_PER_SECOND = 1_500_000;
const AUDIO_BITS_PER_SECOND = 128_000;
/** Anything longer is refused rather than made the user wait its full length. */
const MAX_DURATION_SECONDS = 10 * 60;

/**
 * The longest stretch of identical picture tolerated inside a clip that otherwise moves.
 *
 * This exists because of a failure none of the earlier checks could see. The re-encode runs
 * in REAL TIME off the source element's own playback, so if decoding stalls part-way — the
 * app is backgrounded, the screen locks, the element scrolls out of view on Android, the
 * device throttles under load — the canvas keeps its last frame while the audio track,
 * which is passed through untouched, carries on perfectly. The output is then a video whose
 * MIDDLE is one still image, with a normal beginning and a normal end. Reported from the
 * live site as: «بيجي في جزء معين ويهنج والصورة تفضل ثابتة — لكن في الآخر والأول شغال عادي».
 *
 * The old guard asked only "did any two frames ever differ", which a mid-clip freeze passes
 * trivially: the beginning moved. So the freeze has to be measured as a SPAN, in the
 * source's own media time.
 *
 * Three seconds, not one: a held shot is a legitimate thing for a video to contain, and a
 * false positive refuses a good upload. Three seconds of a pixel-identical frame in a clip
 * that is otherwise moving is a stall, not an edit.
 */
const MAX_FROZEN_SPAN_SECONDS = 3;

/** How often the picture is sampled, in wall-clock milliseconds. See `sampleFreeze`. */
const FREEZE_SAMPLE_MS = 500;

/**
 * How different two sampled frames must be to count as movement.
 *
 * Exact pixel equality does NOT work here, and testing it is what showed that. A frozen
 * stretch of a lossy stream is not pixel-identical when it comes back out of the decoder:
 * VP8 and H.264 refresh their reference frames, so the same held picture decodes with a
 * point or two of noise per channel, frame after frame. Compared exactly, that noise reads
 * as motion — so the first version of this detector scored a deliberately frozen 4.5-second
 * stretch as three short ones and let the clip through.
 *
 * So movement is a mean absolute difference across the sample, in 0-255 units. Two is
 * comfortably above codec noise and far below any real change in the picture.
 */
const PIXEL_DELTA = 12;
/** What share of the sampled pixels must move that much for the picture to count as moving. */
const MOVED_FRACTION = 0.01;

/**
 * Did the picture move between two samples?
 *
 * A mean absolute difference over the WHOLE frame was the first attempt, and it is nearly
 * blind to the content this app actually carries. One person talking to a locked-off
 * camera changes a few percent of the pixels by a lot; averaged over every pixel that
 * lands around one or two levels — indistinguishable from codec noise. So the mean was
 * either set low enough to call noise "motion" or high enough to call a talking head
 * "frozen", and there is no value that is both.
 *
 * Counting pixels instead separates them cleanly: codec noise moves almost every pixel by
 * a little, real motion moves some pixels by a lot.
 */
function pictureMoved(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  let moved = 0;
  let total = 0;
  for (let i = 0; i < a.length; i += 4) {
    total++;
    const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    if (d > PIXEL_DELTA * 3) moved++;
  }
  return total > 0 && moved / total > MOVED_FRACTION;
}

type Progress = (percent: number) => void;

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const t of candidates) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* older browser */ }
  }
  return null;
}

/**
 * What video codec a file actually carries.
 *
 * ## Why this has to exist
 *
 * Compression only ever ran on files OVER the size cap. Everything smaller went up exactly
 * as the phone recorded it — and an iPhone records HEVC (H.265) in a `.mov` by default,
 * which `ALLOWED_VIDEO` accepts. Chrome on Android cannot decode HEVC. So a short clip from
 * an iPhone was stored untouched and then played, for every Android viewer, as a frozen
 * picture with working sound. That is the same symptom the compressor was blamed for, from
 * a completely different cause, on the one path the compressor never saw.
 *
 * It cannot be caught by playing the file either: on the iPhone that uploaded it, HEVC
 * decodes perfectly. The uploader sees it work. Only the file's own bytes say what it is.
 *
 * ## How
 *
 * MP4 and MOV are both ISO base media files, and the codec is a four-character tag inside
 * the sample description — `hvc1`/`hev1` for HEVC, `avc1`/`avc3` for H.264, `av01` for AV1.
 * The tags are searched for directly rather than by walking the box tree: `moov` sits at the
 * front in some files and at the very end in others, walking it properly means handling
 * 64-bit box sizes and fragmented files, and a plain search over both ends of the file gets
 * the same answer. A false positive costs one unnecessary re-encode; missing a real HEVC
 * file costs a video nobody can watch, so the tags are checked HEVC-first.
 */
export type VideoCodec = 'hevc' | 'h264' | 'av1' | 'unknown';

function findAscii(buf: Uint8Array, tag: string): boolean {
  const t = [tag.charCodeAt(0), tag.charCodeAt(1), tag.charCodeAt(2), tag.charCodeAt(3)];
  const end = buf.length - 4;
  for (let i = 0; i <= end; i++) {
    if (buf[i] === t[0] && buf[i + 1] === t[1] && buf[i + 2] === t[2] && buf[i + 3] === t[3]) return true;
  }
  return false;
}

/** How much of each end of the file to read. The header and the index live in one or the other. */
const CODEC_SCAN_BYTES = 4 * 1024 * 1024;

export async function detectVideoCodec(file: File): Promise<VideoCodec> {
  try {
    const head = new Uint8Array(await file.slice(0, CODEC_SCAN_BYTES).arrayBuffer());
    const tail = file.size > CODEC_SCAN_BYTES * 2
      ? new Uint8Array(await file.slice(file.size - CODEC_SCAN_BYTES).arrayBuffer())
      : new Uint8Array(0);
    const has = (tag: string) => findAscii(head, tag) || findAscii(tail, tag);

    // HEVC first, and Dolby Vision with it — a DV file is an HEVC base layer.
    if (has('hvc1') || has('hev1') || has('dvh1') || has('dvhe')) return 'hevc';
    if (has('av01')) return 'av1';
    if (has('avc1') || has('avc3')) return 'h264';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Whether this file must be re-encoded before it is stored, whatever its size.
 *
 * HEVC and AV1 both decode on the device that recorded them and fail on a large share of
 * everything else. `.mov` whose codec could not be read is included: the container is
 * overwhelmingly an iPhone recording, and being wrong costs one re-encode, while being
 * wrong the other way costs a video that some viewers can never watch.
 */
export async function needsTranscodeForCompat(file: File): Promise<boolean> {
  if (!file.type.startsWith('video/')) return false;
  const codec = await detectVideoCodec(file);
  if (codec === 'hevc' || codec === 'av1') return true;
  return codec === 'unknown' && file.type === 'video/quicktime';
}

/** Whether this browser can do it at all — lets the UI promise nothing it cannot deliver. */
/**
 * Why a compression attempt gave up.
 *
 * Every `return null` below used to be indistinguishable from every other one, so the
 * uploader showed a single message blaming HEVC — including when the real cause was a clip
 * longer than the ceiling, or a file that simply could not be made smaller. Being told to
 * change an iPhone camera setting that has nothing to do with your problem is worse than
 * being told nothing.
 */
export type CompressFailure =
  | 'unsupported-browser'
  | 'unreadable'
  | 'too-long'
  | 'no-video-track'
  | 'no-motion'
  | 'stalled'
  | 'truncated'
  | 'canceled'
  | 'not-smaller'
  | 'error';

/**
 * Numbers attached to a failure, so the message can say WHY rather than guess.
 *
 * Three rounds were spent unable to tell a real mid-clip freeze from an encode that was
 * simply cut short, because both ended at the same `fail('stalled')` with nothing to
 * separate them. These are the figures that separate them.
 */
export type CompressStats = {
  /** Longest span, in WALL-CLOCK seconds, during which the picture did not change. */
  worstFrozenSpan: number;
  /** Whether the encode was paused because the page went to the background. */
  wasPaused: boolean;
  /** Where source playback actually got to, in seconds. */
  playedSeconds: number;
  /** The source's own duration, in seconds. */
  sourceSeconds: number;
  /** Whether playback reached the end rather than being cut off. */
  reachedEnd: boolean;
  /** Wall-clock seconds the encode took. Greater than sourceSeconds means slower than real time. */
  wallSeconds: number;
};

export function canCompressVideo(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof (canvas as HTMLCanvasElement & { captureStream?: unknown }).captureStream === 'function' &&
    pickMimeType() !== null
  );
}

export async function compressVideo(
  file: File,
  onProgress?: Progress,
  /**
   * Where to put the `<video>` while it plays. **Pass a real, on-screen element.**
   *
   * Chrome on Android suspends frame decoding for a media element that is not visible —
   * audio keeps playing, but no new frames arrive. Hidden off-screen, the canvas therefore
   * redrew one still for the whole clip while the sound ran normally, which is exactly the
   * symptom that was reported. Desktop Chrome does not do this, which is why a harness on
   * the desktop passed while real phones failed.
   *
   * So the element is mounted where the user can see it, as a live preview. Omit this and
   * it falls back to an off-screen mount, which works on desktop and cannot be relied on
   * anywhere else.
   */
  mountInto?: HTMLElement | null,
  /** Called once with the reason when the result is null, and the figures behind it. */
  onFailure?: (reason: CompressFailure, stats?: CompressStats) => void,
  /**
   * `acceptLarger` when the re-encode is for COMPATIBILITY rather than size.
   *
   * A short HEVC clip re-encoded to VP8 very often comes out bigger — HEVC is the more
   * efficient codec, which is the whole reason phones use it. Refusing that output would
   * send the file up in the codec nobody can play, which is the bug this exists to fix.
   */
  opts?: {
    acceptLarger?: boolean;
    /** Called when the output is usable but imperfect — choppy, or cut short. */
    onWarning?: (reason: CompressFailure, stats?: CompressStats) => void;
  },
): Promise<File | null> {
  let stats: CompressStats | undefined;
  const fail = (reason: CompressFailure): null => {
    onFailure?.(reason, stats);
    return null;
  };
  /** Reported alongside a file that WAS produced — a quality note, not a refusal. */
  const warn = (reason: CompressFailure) => { opts?.onWarning?.(reason, stats); };

  const mimeType = pickMimeType();
  if (!mimeType || !canCompressVideo()) return fail('unsupported-browser');

  const url = URL.createObjectURL(file);
  // Declared out here so the `finally` can stop them on every exit path.
  let canvasStream: MediaStream | null = null;
  let audioTrack: MediaStreamTrack | null = null;

  /**
   * Keep the screen awake for the duration.
   *
   * The re-encode runs in real time off the source element's own playback, so the screen
   * turning off part-way is enough to stall frame decoding — the canvas then holds one
   * frame while the audio, passed through untouched, keeps going, and the finished video
   * has a still image in the middle. A two-minute clip on a phone whose screen sleeps after
   * thirty seconds hits this every time.
   *
   * Best-effort and never fatal: the API needs a secure context and a visible document, is
   * missing on some browsers entirely, and a rejected request must not stop a compression
   * that would otherwise work.
   */
  let wakeLock: { release: () => Promise<void> } | null = null;
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
  } catch { /* denied, unsupported, or the tab is not visible — carry on regardless */ }
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  // NOT crossOrigin. A blob: URL is same-origin, and forcing CORS mode on it made the
  // canvas behave as if tainted: the audio track came through fine while the video froze
  // after a handful of frames, which is exactly what a dead canvas stream looks like.

  // The element must be in the document AND actually rendered. A detached or invisible
  // <video> is allowed to play, but browsers — Android Chrome in particular — stop
  // advancing its decoded frames when nothing can display it, so the canvas keeps
  // redrawing one still while the audio runs on.
  if (mountInto) {
    Object.assign(video.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      borderRadius: '10px',
    } as Partial<CSSStyleDeclaration>);
    mountInto.appendChild(video);
  } else {
    // Fallback only. Kept barely visible rather than fully hidden — `opacity: 0` and
    // off-screen positions are precisely what triggers the suspension above.
    Object.assign(video.style, {
      position: 'fixed',
      bottom: '2px',
      insetInlineStart: '2px',
      width: '2px',
      height: '2px',
      opacity: '0.01',
      zIndex: '0',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(video);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('cannot read video'));
    });

    /**
     * A file recorded by `MediaRecorder` — which includes anything captured in a browser
     * and re-shared — carries no duration in its header, so the element reports
     * `Infinity`. Seeking past the end forces the browser to resolve the real length.
     * Without this, every such file was silently refused and the user was told to compress
     * it themselves.
     */
    if (!isFinite(video.duration)) {
      await new Promise<void>(resolve => {
        const onUpdate = () => {
          video.removeEventListener('timeupdate', onUpdate);
          resolve();
        };
        video.addEventListener('timeupdate', onUpdate);
        video.currentTime = 1e101;
        // Never hang on a file that refuses to resolve.
        setTimeout(() => { video.removeEventListener('timeupdate', onUpdate); resolve(); }, 3000);
      });
      video.currentTime = 0;
    }

    if (!video.duration || !isFinite(video.duration)) return fail('unreadable');
    if (video.duration > MAX_DURATION_SECONDS) return fail('too-long');

    /**
     * No decodable video track.
     *
     * `videoWidth === 0` after metadata means the browser parsed the file but cannot decode
     * its picture — overwhelmingly because of the codec. An iPhone records HEVC (H.265) by
     * default, and Chrome on Android cannot decode it, so such a file plays its AUDIO
     * perfectly while the picture never moves. Re-encoding it here would faithfully produce
     * a file with sound and one frozen frame, which is worse than refusing: the user would
     * publish it believing it worked.
     */
    if (!video.videoWidth || !video.videoHeight) {
      return fail('no-video-track');
    }

    const scale = Math.min(1, TARGET_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    // Even dimensions: odd widths break some encoders outright.
    const width = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
    const height = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fail('unsupported-browser');

    canvasStream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream })
      .captureStream(30);

    // The audio is taken from the element's own stream and passed through as-is. Decoding
    // and re-encoding it separately would cost time and quality for no size worth having —
    // audio is a rounding error next to the video track.
    try {
      const el = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
      const elStream = el.captureStream?.() ?? el.mozCaptureStream?.();
      audioTrack = elStream?.getAudioTracks()[0] ?? null;
    } catch { /* a video with no audio, or a browser that will not expose it */ }

    const mixed = new MediaStream();
    canvasStream.getVideoTracks().forEach(t => mixed.addTrack(t));
    if (audioTrack) mixed.addTrack(audioTrack);

    const recorder = new MediaRecorder(mixed, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const done = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });

    recorder.start(1000);
    await video.play();

    /**
     * One canvas paint per DECODED frame.
     *
     * `requestVideoFrameCallback` fires when the element actually has a new frame, which is
     * the only signal that matches what is being recorded. The previous version used
     * `requestAnimationFrame` and bailed out on `video.paused` — so a single momentary
     * stall ended the loop for good and the rest of the clip recorded as one frozen image
     * while the audio kept going. rAF is kept only as a fallback, and it no longer stops:
     * it skips a paint and schedules the next one.
     */
    let stopPump = false;
    type WithRVFC = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (h: number) => void;
    };
    const v = video as WithRVFC;
    let raf = 0;
    let rvfc = 0;

    /**
     * Frames painted, and whether any two of them differed.
     *
     * This is the check that should have existed from the start. Three separate attempts at
     * this file shipped a compressor that could return a video with working sound and a
     * frozen picture, and nothing in the code would have noticed — the user found out by
     * publishing it. A pipeline that can silently produce a still image must verify that it
     * did not.
     */
    let painted = 0;
    let sourceFirst: Uint8ClampedArray | null = null;
    let sourceMoved = false;
    let canvasMoved = false;
    let lastReportedPct = -1;

    /**
     * The freeze detector — sampled on a WALL-CLOCK interval, and measured on the wall clock.
     *
     * Both of those were wrong before, and each was wrong badly enough on its own to refuse
     * good videos:
     *
     * 1. It sampled every fifth PAINT. The gap between two samples was therefore
     *    `5 / paint-rate` seconds, which the detector does not control — so a device
     *    painting under about 1.7 frames a second produced sample gaps over the three-second
     *    limit *by construction*, and every clip it encoded was refused as frozen no matter
     *    how good the output was. A phone re-encoding a high-bitrate clip paints at exactly
     *    that sort of rate. This is what blocked a real upload, repeatedly, and no amount of
     *    "keep the screen on" could have helped, because nothing had frozen.
     * 2. It measured the span in the source's media time. The hole is in the RECORDER's
     *    timeline, which is wall clock. The two only agree while playback advances normally
     *    — and when the media element stalls, which is the very failure being hunted,
     *    `currentTime` stops advancing too, so a real freeze measured as zero.
     *
     * So: a fixed 500ms timer reads the canvas whether or not anything painted, and the
     * span is wall-clock seconds during which the picture did not change.
     */
    let lastSig: Uint8ClampedArray | null = null;
    let lastSigChangeWall = Date.now();
    let lastSigChangeMedia = 0;
    let worstFrozenSpan = 0;
    let sawFirstChange = false;

    const probe = document.createElement('canvas');
    // 64x36, not 32x18: a coarser sample cannot see small movement, and mistaking real
    // motion for a freeze refuses a perfectly good upload.
    probe.width = 64;
    probe.height = 36;
    const pctx = probe.getContext('2d', { willReadFrequently: true });

    const paint = () => {
      ctx.drawImage(video, 0, 0, width, height);
      painted++;

      /**
       * Two samples, and the comparison BETWEEN them is the whole point.
       *
       * The first version of this check sampled `video` — the source — and called that
       * verification. It was not: the bug it was written to catch is the CANVAS going
       * dead while the source element keeps decoding, so sampling the source returns
       * "moving" in exactly the case that is broken. It would have passed the very
       * regression that caused it to be written.
       *
       * So the canvas is sampled too, and only the pair is meaningful:
       *   source moves, canvas does not  → the pipeline is broken, throw the result away.
       *   neither moves                  → a legitimately static clip (a held slide, a
       *                                     recitation over one frame, a cover with
       *                                     audio). Perfectly valid; keep it. The old
       *                                     check discarded these and told the author
       *                                     their codec was unsupported.
       */
      // Only on a whole-percent change: this fired 30-60 times a second into a React
      // setState, re-rendering a large modal during the most CPU-bound moment on the
      // weakest device in the user base.
      if (video.duration) {
        const pct = Math.min(99, Math.round((video.currentTime / video.duration) * 100));
        if (pct !== lastReportedPct) {
          lastReportedPct = pct;
          onProgress?.(pct);
        }
      }
    };

    /**
     * Reads the picture on a timer, independent of painting.
     *
     * Independence is the point: if paints stop entirely, this keeps running and keeps
     * charging wall-clock time against the unchanged picture. The previous design could
     * only sample from inside `paint()`, so when frames stopped arriving it stopped
     * looking, and then inferred a freeze from the ABSENCE of samples — which is also how
     * it confused "slow" with "broken".
     */
    const sampleFreeze = () => {
      if (!pctx) return;
      const now = Date.now();

      if (!sourceMoved) {
        pctx.drawImage(video, 0, 0, 64, 36);
        const sig = pctx.getImageData(0, 0, 64, 36).data;
        if (sourceFirst === null) sourceFirst = sig;
        else if (pictureMoved(sig, sourceFirst)) sourceMoved = true;
      }

      pctx.drawImage(canvas, 0, 0, 64, 36);
      const csig = pctx.getImageData(0, 0, 64, 36).data;
      if (lastSig === null) {
        lastSig = csig;
        lastSigChangeWall = now;
        lastSigChangeMedia = video.currentTime;
        return;
      }
      if (pictureMoved(csig, lastSig)) {
        canvasMoved = true;
        // Only spans BETWEEN two observed changes count. The span before the very first
        // change is start-up — the recorder, the decoder and the first keyframe — and
        // charging that as a freeze condemned every clip that opens on a title card.
        if (sawFirstChange) {
          const span = (now - lastSigChangeWall) / 1000;
          if (span > worstFrozenSpan) worstFrozenSpan = span;
        }
        sawFirstChange = true;
        lastSig = csig;
        lastSigChangeWall = now;
        lastSigChangeMedia = video.currentTime;
      }
    };
    const freezeTimer = setInterval(sampleFreeze, FREEZE_SAMPLE_MS);

    /**
     * Going to the background PAUSES the work instead of corrupting it.
     *
     * This is the fix for the reported bug, as opposed to the detection of it. When the
     * page is hidden the browser stops giving the element frames, but the recorder and the
     * passthrough audio track carry on — that mismatch IS the frozen middle with running
     * sound. Pausing both together leaves no hole at all: the encode simply takes longer.
     *
     * The wake lock is also released by the browser on hide, so it is re-requested on the
     * way back rather than being silently gone for the rest of the encode.
     */
    let wasPaused = false;
    const onVisibility = () => {
      try {
        if (document.hidden) {
          wasPaused = true;
          video.pause();
          if (recorder.state === 'recording') recorder.pause();
        } else {
          if (recorder.state === 'paused') recorder.resume();
          void video.play().catch(() => {});
          const nav = navigator as Navigator & {
            wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
          };
          nav.wakeLock?.request('screen').then(l => { wakeLock = l; }).catch(() => {});
        }
      } catch { /* a browser that will not pause mid-record — carry on */ }
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (typeof v.requestVideoFrameCallback === 'function') {
      const onFrame = () => {
        if (stopPump) return;
        paint();
        rvfc = v.requestVideoFrameCallback!(onFrame);
      };
      rvfc = v.requestVideoFrameCallback(onFrame);
    } else {
      const tick = () => {
        if (stopPump) return;
        // No `paused` bail-out: a brief stall must not end the recording.
        if (!video.ended) paint();
        raf = requestAnimationFrame(tick);
      };
      tick();
    }

    /**
     * Wait for the end — but never unconditionally.
     *
     * This was the only await in the function with no timeout and no error path, and
     * three ordinary things stop `ended` from ever arriving: a decode error mid-playback
     * (the `onerror` set during metadata belongs to a promise that already settled), the
     * tab being backgrounded on Android during a multi-minute real-time encode, and a
     * source whose duration only "resolved" via the seek timeout. Any of them left the
     * composer pinned on "جاري الضغط" with the publish button dead until a page reload.
     *
     * The ceiling is generous — real time plus a third, plus thirty seconds — because
     * overshooting truncates a legitimate encode, which is worse than waiting.
     */
    const startedAt = Date.now();
    const budgetMs = Math.max(30_000, video.duration * 1000 * 1.35 + 30_000);
    await new Promise<void>(resolve => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      video.onended = finish;
      video.onerror = finish;
      const guard = setInterval(() => {
        // Playback that has stopped short, or simply run out of budget.
        if (video.ended || Date.now() - startedAt > budgetMs) {
          clearInterval(guard);
          finish();
        }
      }, 1000);
      setTimeout(() => { clearInterval(guard); finish(); }, budgetMs + 2000);
    });

    stopPump = true;
    clearInterval(freezeTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    if (raf) cancelAnimationFrame(raf);
    if (rvfc && typeof v.cancelVideoFrameCallback === 'function') v.cancelVideoFrameCallback(rvfc);
    // How much media was actually recorded. NOT the source's duration: the recorder is
    // started before playback, frames drop, and stalls happen — stamping the source length
    // into the header points the scrubber's end past where data exists.
    const recordedSeconds = (Date.now() - startedAt) / 1000;

    // One last frame, or the final second can come out blank.
    ctx.drawImage(video, 0, 0, width, height);
    // Tracks ending can auto-stop the recorder, and stop() then throws InvalidStateError —
    // which used to land in the outer catch and discard a finished encode.
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* already stopped */ }
    await Promise.race([
      done,
      new Promise<void>(r => setTimeout(r, 10_000)),
    ]);

    /**
     * Nothing moved. The source decoded audio but never a second distinct frame — an
     * undecodable video codec is the usual cause. Returning this blob would hand back a
     * file with sound and a still image.
     */
    if (sourceMoved && !canvasMoved && painted > 10) {
      return fail('no-motion');
    }

    /**
     * A freeze in the middle, or one that ran to the end of the clip.
     *
     * The trailing span has to be counted separately: a stall that never recovers produces
     * no further signature CHANGE, so nothing inside the loop above ever records it.
     *
     * Only for clips that move at all. A deliberately static video — one held frame over a
     * recitation, a cover image with audio — is a legitimate thing to post, and measuring
     * it as one long freeze would refuse it.
     */
    /**
     * Where playback ACTUALLY got to — not where the source ends.
     *
     * This used to read `video.duration` unconditionally. The wait above gives up after a
     * budget, so playback can stop short; the untouched remainder was then charged as
     * though the picture had frozen there.
     */
    const reachedEnd = !!video.ended;
    const playedSeconds = reachedEnd && Number.isFinite(video.duration) ? video.duration : video.currentTime;

    // A trailing span is only charged when the clip did NOT run to the end. A video that
    // finishes on a held shot or a fade to black is a normal video, and measuring the hold
    // at its end as a freeze refused exactly those.
    if (canvasMoved && sawFirstChange && !reachedEnd) {
      const trailing = (Date.now() - lastSigChangeWall) / 1000;
      if (trailing > worstFrozenSpan) worstFrozenSpan = trailing;
    }

    stats = {
      worstFrozenSpan,
      wasPaused,
      playedSeconds,
      sourceSeconds: Number.isFinite(video.duration) ? video.duration : 0,
      reachedEnd,
      wallSeconds: recordedSeconds,
    };

    /**
     * From here on, a quality problem WARNS. It does not throw the encode away.
     *
     * The previous version refused, and the refusal reached a real author on the live site
     * and left them unable to post at all — twice, both times because of a guard I added to
     * protect them. The lesson is in the asymmetry: a video that is choppy, or shorter than
     * the original, is still a video the author can look at and decide about. A wall gives
     * them nothing and no way forward. Only an output that is definitely unusable — no
     * decodable picture at all, or bigger than what we started with — is still refused.
     */
    if (!reachedEnd && stats.sourceSeconds > 0 && playedSeconds < stats.sourceSeconds - 2) {
      warn('truncated');
    } else if (canvasMoved && worstFrozenSpan > MAX_FROZEN_SPAN_SECONDS) {
      warn('stalled');
    }

    let blob: Blob = new Blob(chunks, { type: mimeType.split(';')[0] });

    /**
     * MediaRecorder cannot rewind its own output, so it never writes a Duration — players
     * then report Infinity and the scrubber is useless. Repaired in the bytes here rather
     * than by making the player seek to the end, which fixed the scrubber and froze the
     * picture: these files have no Cues index either, so the demuxer could not find a
     * keyframe after such a seek.
     *
     * `writeWebmDuration` returns the original blob unchanged on anything unexpected, so
     * the worst case is the scrubber we already had — never a corrupted file.
     */
    if (blob.type.includes('webm')) {
      blob = await writeWebmDuration(blob, recordedSeconds);
    }

    // A clip that is already efficiently encoded can come out BIGGER. Returning it would
    // make the upload worse, which is the opposite of the point.
    if (blob.size >= file.size && !opts?.acceptLarger) return fail('not-smaller');

    onProgress?.(100);
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const base = file.name.replace(/\.[^.]+$/, '') || 'video';
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    return fail('error');
  } finally {
    // Always: the element holds the decoded file, and a blob URL left alive keeps the whole
    // original in memory for the life of the page.
    // Tracks left running hold the camera pipeline and the audio graph open for the life
    // of the page.
    try { void wakeLock?.release(); } catch { /* already gone */ }
    try { canvasStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); } catch { /* gone */ }
    try { audioTrack?.stop(); } catch { /* gone */ }
    try { video.pause(); } catch { /* already stopped */ }
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
