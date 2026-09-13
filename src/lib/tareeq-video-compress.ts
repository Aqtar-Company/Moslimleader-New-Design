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
  // Needed for captureStream on a blob URL in some browsers, harmless otherwise.
  video.crossOrigin = 'anonymous';

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('cannot read video'));
    });

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

    let raf = 0;
    const draw = () => {
      if (video.ended || video.paused) return;
      ctx.drawImage(video, 0, 0, width, height);
      onProgress?.(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
      raf = requestAnimationFrame(draw);
    };
    draw();

    await new Promise<void>(resolve => { video.onended = () => resolve(); });
    cancelAnimationFrame(raf);
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
    URL.revokeObjectURL(url);
  }
}
