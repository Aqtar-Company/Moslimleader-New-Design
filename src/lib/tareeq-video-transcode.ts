/**
 * Re-encode a video in the browser with WebCodecs — the replacement for the real-time
 * MediaRecorder path in `tareeq-video-compress.ts`.
 *
 * ## Why a second implementation exists
 *
 * The MediaRecorder path works by PLAYING the source `<video>` and recording a canvas that
 * mirrors it. That ties the encode to playback, and playback runs on a clock the browser is
 * entitled to suspend — screen lock, backgrounding, an element scrolled out of view, or
 * simply a decoder that cannot keep up with a 259 MB source. When that happens the canvas
 * holds one frame while the audio track, captured separately, keeps running. The output is
 * a video with a frozen middle and working sound. Three rounds of guards were written to
 * DETECT that; each one also refused good videos, and none could prevent it, because the
 * cause is architectural: two independent clocks, one of which the OS may pause.
 *
 * WebCodecs has no playback and no clock. Packets are pulled from the container, decoded,
 * scaled, encoded and written, as fast as the hardware allows — measured at roughly five
 * times faster than real time with a software encoder on a server CPU. Every output frame
 * is derived from a specific input packet with its own timestamp, and the audio is copied
 * packet-for-packet from the same demuxer, so a frozen picture with correct audio is not a
 * state this pipeline can reach. Backgrounding costs throughput, never correctness.
 *
 * `mediabunny` does the container work (demux MP4/MOV/WebM, mux MP4/WebM) and drives the
 * WebCodecs encoders. It needs no WebAssembly, no SharedArrayBuffer and no cross-origin
 * isolation — none of which this site has. It is imported lazily so its ~100 KB never lands
 * in the main bundle for the vast majority of page views that never upload a video.
 *
 * ## What is NOT handled here
 *
 * Browser support. WebCodecs is missing on Firefox for Android and on iOS before 16.4, so
 * the caller MUST keep the MediaRecorder path as the fallback: `canTranscodeWithWebCodecs()`
 * says which path to take, and `transcodeVideo()` returns `null` with a reason whenever it
 * cannot finish, so the caller can fall through.
 */

import type { CompressFailure } from './tareeq-video-compress';

/** Longest edge of the output. 720p is already more than Tareeq ever displays. */
const TARGET_MAX_DIMENSION = 1280;
/** Output video bitrate. 1.5 Mbps at 720p is visually clean for phone content. */
const VIDEO_BITS_PER_SECOND = 1_500_000;
/** Refuse anything longer — same ceiling as the MediaRecorder path. */
const MAX_DURATION_SECONDS = 10 * 60;

export type TranscodeProgress = (percent: number) => void;

/** Whether this browser has the WebCodecs surface the pipeline needs. Cheap; no imports. */
export function canTranscodeWithWebCodecs(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof w.VideoEncoder === 'function' && typeof w.VideoDecoder === 'function';
}

/**
 * Re-encodes `file` to 720p H.264 in MP4 when the browser can encode H.264, otherwise to
 * VP9/VP8 in WebM. Resolves to the new file, or `null` — with `onFailure` called — when it
 * cannot. Never throws.
 *
 * `acceptLarger` is for re-encodes done for COMPATIBILITY (an HEVC source): those may come
 * out bigger than the input and must still be accepted.
 */
export async function transcodeVideo(
  file: File,
  onProgress?: TranscodeProgress,
  onFailure?: (reason: CompressFailure, detail?: string) => void,
  opts?: {
    acceptLarger?: boolean;
    /**
     * Aborting cancels the conversion. Without it, closing the composer left the encode
     * running to completion — WebCodecs, unlike a detached <video>, does not stall — and
     * the finished file was then uploaded to a post that no longer existed.
     */
    signal?: AbortSignal;
  },
): Promise<File | null> {
  const fail = (reason: CompressFailure, detail?: string): null => {
    onFailure?.(reason, detail);
    return null;
  };

  if (!canTranscodeWithWebCodecs()) return fail('unsupported-browser', 'no WebCodecs');

  // Lazy: the library is only paid for by the page that actually re-encodes a video.
  let mb: typeof import('mediabunny');
  try {
    mb = await import('mediabunny');
  } catch (e) {
    return fail('error', `import: ${String(e)}`);
  }

  const {
    Input, BlobSource, Output, BufferTarget, Conversion, Quality,
    Mp4OutputFormat, WebMOutputFormat, getFirstEncodableVideoCodec,
    MP4, QTFF, WEBM, MATROSKA,
  } = mb;

  let input: InstanceType<typeof Input> | null = null;
  try {
    // Only the containers phones and editors actually produce. Listing every format
    // mediabunny knows would pull their demuxers into the chunk for nothing.
    input = new Input({
      source: new BlobSource(file, {
        // 8 MiB window over the file. The 259 MB source is never resident in memory —
        // the object URL + <video> approach kept the whole decode pipeline alive for it.
        maxCacheSize: 8 * 1024 * 1024,
      }),
      formats: [MP4, QTFF, WEBM, MATROSKA],
    });

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) return fail('no-video-track', 'no video track in container');

    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) return fail('unreadable', `duration=${duration}`);
    if (duration > MAX_DURATION_SECONDS) return fail('too-long', `${Math.round(duration)}s`);

    // Can this browser DECODE the source? An iPhone HEVC clip on Chrome/Android cannot be,
    // and it is far better to know now than after a full pass.
    if (!(await videoTrack.canDecode())) {
      return fail('no-video-track', `undecodable source codec ${String(videoTrack.codec)}`);
    }

    // Display dimensions are AFTER rotation, which is what the width/height options refer
    // to. Only the long edge is pinned; mediabunny derives the other from the aspect ratio,
    // so a portrait phone clip stays portrait and nothing is ever upscaled.
    const dw = videoTrack.displayWidth;
    const dh = videoTrack.displayHeight;
    const landscape = dw >= dh;
    const longEdge = Math.min(TARGET_MAX_DIMENSION, landscape ? dw : dh);
    const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
    const size = landscape ? { width: even(longEdge) } : { height: even(longEdge) };

    // H.264 first: it plays on iOS, which WebM does not. The probe is asked with the real
    // output dimensions because encoder support can depend on them.
    const probeDims = landscape
      ? { width: even(longEdge), height: even(longEdge * dh / dw) }
      : { width: even(longEdge * dw / dh), height: even(longEdge) };
    const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'vp8'], {
      ...probeDims,
      quality: new Quality({ bitrate: VIDEO_BITS_PER_SECOND }),
    });
    if (!codec) return fail('unsupported-browser', 'no encodable video codec');

    const isMp4 = codec === 'avc';
    const target = new BufferTarget();
    const output = new Output({
      // 'in-memory' puts the index at the front so the file plays progressively. Its cost
      // is holding the output in memory until finalize — which BufferTarget does anyway.
      format: isMp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
      target,
    });

    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: {
        ...size,
        fit: 'contain',
        codec,
        quality: new Quality({ bitrate: VIDEO_BITS_PER_SECOND }),
        // Seeking lands on a keyframe; two seconds keeps the scrubber responsive without
        // bloating the file. (Also forces a real transcode, which is the point.)
        keyFrameInterval: 2,
        // No `hardwareAcceleration` hint, on purpose. `'prefer-hardware'` is REJECTED
        // outright by the encoder on a device without a hardware session for that codec —
        // the whole conversion fails at init — and the capability probe above did not carry
        // the hint, so probe and encode disagreed. The default lets the browser pick, which
        // is what mediabunny's own docs recommend.
      },
      // Audio is left to mediabunny's own decision: an AAC track going into MP4 is COPIED,
      // packet for packet, with no decode and no re-encode — which is also why this works
      // on iOS 16.4–18, whose WebCodecs has no AudioEncoder. Anything that cannot be copied
      // is transcoded.
      showWarnings: false,
    });

    const reasons = conversion.discardedTracks.map(d => `${d.track.type}:${d.reason}`).join(',');
    if (!conversion.isValid) {
      // Map mediabunny's reasons onto the union the UI already has Arabic strings for.
      const videoReason = conversion.discardedTracks.find(d => d.track.type === 'video')?.reason;
      if (videoReason === 'undecodable_source_codec' || videoReason === 'unknown_source_codec') {
        return fail('no-video-track', reasons);
      }
      return fail('unsupported-browser', reasons);
    }

    /**
     * A video-only output is "valid" to the muxer — MP4 and WebM both allow zero audio
     * tracks — so a source WITH audio whose track could not be carried (AAC into WebM on a
     * browser with no AAC decoder or no Opus encoder) would come out SILENT, and nothing
     * would have said so. Refuse instead: the MediaRecorder fallback captures the element's
     * audio directly and does not have this hole.
     */
    const audioIn = await input.getPrimaryAudioTrack();
    if (audioIn && conversion.discardedTracks.some(d => d.track.type === 'audio')) {
      return fail('unsupported-browser', `audio dropped: ${reasons}`);
    }

    if (opts?.signal?.aborted) return fail('canceled', 'aborted before start');
    opts?.signal?.addEventListener('abort', () => { void conversion.cancel(); }, { once: true });

    let lastPct = -1;
    conversion.onProgress = (p: number) => {
      const pct = Math.min(99, Math.floor(p * 100));
      if (pct !== lastPct) {
        lastPct = pct;
        onProgress?.(pct);
      }
    };

    await conversion.execute();

    const buffer = target.buffer;
    if (!buffer || buffer.byteLength === 0) return fail('error', 'empty output');
    if (buffer.byteLength >= file.size && !opts?.acceptLarger) return fail('not-smaller');

    onProgress?.(100);
    const ext = isMp4 ? 'mp4' : 'webm';
    const type = isMp4 ? 'video/mp4' : 'video/webm';
    const base = file.name.replace(/\.[^.]+$/, '') || 'video';
    return new File([buffer], `${base}.${ext}`, { type });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    if (e instanceof mb.ConversionCanceledError) return fail('canceled', 'canceled');
    // An input the demuxer does not recognise, as opposed to one it cannot decode.
    if (e instanceof mb.UnsupportedInputFormatError) return fail('unreadable', msg);
    return fail('error', msg);
  } finally {
    // Releases the source window and any in-flight decoder. Without it a failed run keeps
    // its 8 MiB cache and decoder alive for the life of the page.
    try { await input?.dispose(); } catch { /* already gone */ }
  }
}
