'use client';
/**
 * Everything the admin's browser does to one file before it becomes a media item —
 * measure it, compress it where that is possible here, upload it, and make its cover.
 * Shared by the single-item form and the multi-file queue so the two cannot drift.
 *
 * Why in the BROWSER: re-encoding video on the server would hold the CPU the shop runs on
 * for minutes (CLAUDE.md). Stills are compressed on the server (sharp) — cheap there.
 */
import { captureVideoFrames } from '@/lib/tareeq-video-frames';
import { dataUrlToBlob } from '@/lib/data-url';
import { computeWaveform } from '@/lib/audio-waveform';
import { transcodeVideo, canTranscodeWithWebCodecs } from '@/lib/tareeq-video-transcode';
import { compressImage } from '@/lib/compress-image';
import { KIND_TO_TYPE, type MediaKind } from '@/lib/free-media-shared';

export type UploadStage = 'queued' | 'measuring' | 'compressing' | 'uploading' | 'finishing' | 'done' | 'error';

export type PreparedMedia = {
  url: string;
  coverUrl: string | null;
  previewUrl: string | null;
  durationSec: number | null;
  waveform: number[] | null;
};

/** Videos above this are re-encoded to 720p H.264 when the browser can. */
const COMPRESS_VIDEO_OVER = 40 * 1024 * 1024;

export const ACCEPT: Record<MediaKind, string> = {
  reel: '.mp4,.webm,.mov,.m4v',
  audio: '.mp3,.m4a,.ogg,.wav',
  video: '.mp4,.webm,.mov,.m4v',
  image: '.jpg,.jpeg,.png,.webp',
  pdf: '.pdf',
};

/** The kind a file belongs to. A video file is a reel when it is dropped on the reels tab. */
export function kindOfFile(file: File, preferred?: MediaKind): MediaKind | null {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (preferred && ACCEPT[preferred].split(',').includes(`.${ext}`)) return preferred;
  for (const k of Object.keys(ACCEPT) as MediaKind[]) {
    if (k === 'reel') continue;
    if (ACCEPT[k].split(',').includes(`.${ext}`)) return k;
  }
  return null;
}

/** A title from a file name: «قصة_الأرنب-الصادق.mp3» → «قصة الأرنب الصادق». */
export function titleFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 190) || name;
}

export function readDuration(file: File, kind: MediaKind): Promise<number | null> {
  if (kind !== 'audio' && kind !== 'video' && kind !== 'reel') return Promise.resolve(null);
  return new Promise(resolve => {
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
    const url = URL.createObjectURL(file);
    const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v); };
    const t = setTimeout(() => done(null), 15_000);
    el.preload = 'metadata';
    el.onloadedmetadata = () => { clearTimeout(t); done(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : null); };
    el.onerror = () => { clearTimeout(t); done(null); };
    el.src = url;
  });
}

export function uploadFile(file: Blob, type: string, onProgress: (p: number) => void, name?: string): Promise<{ url?: string; previewUrl?: string | null; thumbUrl?: string | null; error?: string }> {
  return new Promise(resolve => {
    const fd = new FormData();
    fd.append('file', file, name ?? (file instanceof File ? file.name : 'file'));
    fd.append('type', type);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        resolve(d.url ? d : { error: d.error || 'فشل الرفع' });
      } catch {
        // nginx answers 413 with an HTML page, not JSON — say what that means.
        resolve({ error: xhr.status === 413 ? 'الملف أكبر من الحد المسموح على السيرفر' : `فشل الرفع (${xhr.status || 'لا اتصال'})` });
      }
    };
    xhr.onerror = () => resolve({ error: 'فشل الاتصال' });
    xhr.open('POST', '/api/admin/free-media/upload');
    xhr.send(fd);
  });
}

/** Compress (client-side) and upload a cover image. */
/**
 * Compress (client-side) and upload a cover image. Resolves to its URL, or `{ error }` with
 * the server's reason — a cover that failed used to vanish without a word.
 *
 * The file goes up under ITS OWN name. It used to be renamed «cover.jpg» whatever it was,
 * and a PNG or WebP (which compressImage keeps in its format, or returns untouched) was
 * then refused by the server as a mismatched extension.
 */
export async function uploadCover(file: File | Blob, onProgress: (p: number) => void): Promise<string | { error: string }> {
  const asFile = file instanceof File ? file : new File([file], 'cover.jpg', { type: file.type || 'image/jpeg' });
  const small = await compressImage(asFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }).catch(() => asFile);
  const r = await uploadFile(small, 'cover', onProgress, small.name || asFile.name);
  return r.url ?? { error: r.error ?? 'تعذّر رفع الصورة' };
}

/** The largest upload the server accepts (nginx's limit; see CLAUDE.md). */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_TAREEQ_MAX_VIDEO_MB) || 50;
/** The largest SOURCE video accepted for compression in the browser. */
export const MAX_SOURCE_VIDEO_MB = 4096;

export async function prepareAndUpload(
  file: File,
  kind: MediaKind,
  onStage: (stage: UploadStage, pct: number, note?: string) => void,
): Promise<PreparedMedia | { error: string }> {
  onStage('measuring', 0);
  const durationSec = await readDuration(file, kind);
  const waveform = kind === 'audio' ? await computeWaveform(file) : null;

  let body: File = file;
  if (kind === 'video' || kind === 'reel') {
    const MB = 1024 * 1024;
    const limit = MAX_UPLOAD_MB * MB;
    if (file.size > MAX_SOURCE_VIDEO_MB * MB) return { error: `الفيديو أكبر من ${MAX_SOURCE_VIDEO_MB / 1024} جيجا — قسّمه لأجزاء` };

    /*
     * Bigger sources are welcome now: anything over the upload cap is compressed in this
     * browser until it fits. The bitrate is chosen from the DURATION so a long video lands
     * under the cap — 1.5 Mbps for short clips (clean 720p), lower for long ones, never
     * below 450 kbps (under that, faces and text in a lesson turn to mush). 10% headroom
     * and 128 kbps for the audio track.
     */
    if (file.size > COMPRESS_VIDEO_OVER || file.size > limit) {
      if (!canTranscodeWithWebCodecs()) {
        if (file.size > limit) return { error: `الفيديو أكبر من ${MAX_UPLOAD_MB} ميجا ويحتاج ضغطاً، وهذا المتصفح لا يضغط الفيديو — افتح الأدمن من كروم أو إيدج` };
      } else {
        const secs = durationSec ?? 0;
        const fit = secs > 0 ? Math.floor(((limit * 0.9 * 8) / secs) - 128_000) : 1_500_000;
        const bitrate = Math.max(450_000, Math.min(1_500_000, fit));
        const expectMb = secs > 0 ? Math.round(((bitrate + 128_000) * secs) / 8 / MB) : null;
        onStage('compressing', 0, expectMb ? `من ${Math.round(file.size / MB)} ميجا إلى نحو ${expectMb} ميجا` : undefined);
        const out = await transcodeVideo(
          file,
          p => onStage('compressing', Math.round(p), expectMb ? `من ${Math.round(file.size / MB)} ميجا إلى نحو ${expectMb} ميجا` : undefined),
          undefined,
          { maxDurationSeconds: 3 * 60 * 60, videoBitrate: bitrate },
        );
        if (out && out.size < file.size) body = out;
        else if (file.size > limit) return { error: 'تعذّر ضغط هذا الفيديو في المتصفح وهو أكبر من حد الرفع — جرّب ملفاً بصيغة MP4' };
        else onStage('compressing', 100, 'تعذّر الضغط — يُرفع الأصل');
      }
    }
    if (body.size > limit) {
      return { error: `حتى بعد الضغط حجمه ${Math.round(body.size / MB)} ميجا، والحد ${MAX_UPLOAD_MB} ميجا — قسّمه لجزأين` };
    }
  }

  onStage('uploading', 0);
  const up = await uploadFile(body, KIND_TO_TYPE[kind], p => onStage('uploading', p));
  if (!up.url) return { error: up.error ?? 'فشل الرفع' };

  onStage('finishing', 100);
  let coverUrl: string | null = null;
  if (kind === 'image') coverUrl = up.thumbUrl ?? null;
  if (kind === 'video' || kind === 'reel') {
    const local = URL.createObjectURL(body);
    const frames = await captureVideoFrames(local, 1).finally(() => URL.revokeObjectURL(local));
    if (frames[0]) {
      const c = await uploadCover(dataUrlToBlob(frames[0]), () => {});
      coverUrl = typeof c === 'string' ? c : null;
    }
  }

  return { url: up.url, coverUrl, previewUrl: up.previewUrl ?? null, durationSec, waveform };
}
