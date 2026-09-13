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

const TARGET_MAX_DIMENSION = 1280;
const VIDEO_BITS_PER_SECOND = 1_500_000;
const AUDIO_BITS_PER_SECOND = 128_000;
/** Anything longer is refused rather than made the user wait its full length. */
const MAX_DURATION_SECONDS = 10 * 60;

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

/** Whether this browser can do it at all — lets the UI promise nothing it cannot deliver. */
export function canCompressVideo(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof (canvas as HTMLCanvasElement & { captureStream?: unknown }).captureStream === 'function' &&
    pickMimeType() !== null
  );
}

export async function compressVideo(file: File, onProgress?: Progress): Promise<File | null> {
  const mimeType = pickMimeType();
  if (!mimeType || !canCompressVideo()) return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  // NOT crossOrigin. A blob: URL is same-origin, and forcing CORS mode on it made the
  // canvas behave as if tainted: the audio track came through fine while the video froze
  // after a handful of frames, which is exactly what a dead canvas stream looks like.

  // The element MUST be in the document. A detached <video> is allowed to play, but
  // browsers stop advancing its decoded frames when nothing can display it — so the canvas
  // kept redrawing the same still image. Off-screen and invisible, but attached.
  Object.assign(video.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '1px',
    height: '1px',
    opacity: '0',
    pointerEvents: 'none',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(video);

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

    if (!video.duration || !isFinite(video.duration) || video.duration > MAX_DURATION_SECONDS) {
      return null;
    }

    const scale = Math.min(1, TARGET_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    // Even dimensions: odd widths break some encoders outright.
    const width = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
    const height = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const canvasStream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream })
      .captureStream(30);

    // The audio is taken from the element's own stream and passed through as-is. Decoding
    // and re-encoding it separately would cost time and quality for no size worth having —
    // audio is a rounding error next to the video track.
    let audioTrack: MediaStreamTrack | null = null;
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

    const paint = () => {
      ctx.drawImage(video, 0, 0, width, height);
      if (video.duration) {
        onProgress?.(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
      }
    };

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

    await new Promise<void>(resolve => { video.onended = () => resolve(); });
    stopPump = true;
    if (raf) cancelAnimationFrame(raf);
    if (rvfc && typeof v.cancelVideoFrameCallback === 'function') v.cancelVideoFrameCallback(rvfc);
    // One last frame, or the final second can come out blank.
    ctx.drawImage(video, 0, 0, width, height);
    recorder.stop();
    await done;

    const blob = new Blob(chunks, { type: mimeType.split(';')[0] });

    // A clip that is already efficiently encoded can come out BIGGER. Returning it would
    // make the upload worse, which is the opposite of the point.
    if (blob.size >= file.size) return null;

    onProgress?.(100);
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const base = file.name.replace(/\.[^.]+$/, '') || 'video';
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    return null;
  } finally {
    // Always: the element holds the decoded file, and a blob URL left alive keeps the whole
    // original in memory for the life of the page.
    try { video.pause(); } catch { /* already stopped */ }
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
