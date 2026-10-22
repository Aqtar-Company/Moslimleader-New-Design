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
        /*
         * Resolution steps down with the length. A long video cannot fit the cap at 720p
         * without a bitrate so low the picture smears, and it looks better at 480p with
         * enough bits than at 720p starved of them. Each step is tried in turn: when the
         * result does not come out smaller than the source, or not under the cap, the next
         * step is tried, instead of giving up.
         */
        const secs = durationSec ?? 0;
        const fit = secs > 0 ? Math.floor(((limit * 0.9 * 8) / secs) - 128_000) : 1_500_000;
        const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
        const all = [
          { dim: 1280, label: '720p', br: clamp(fit, 450_000, 1_500_000) },
          { dim: 854, label: '480p', br: clamp(fit, 300_000, 900_000) },
          { dim: 640, label: '360p', br: clamp(fit, 200_000, 600_000) },
        ];
        // Start where the length allows: a video that already fits, or has room for 700 kbps,
        // starts at 720p; one with room for 350 kbps at 480p; anything longer at 360p.
        const start = file.size <= limit || fit >= 700_000 ? 0 : fit >= 350_000 ? 1 : 2;
        const steps = all.slice(start);

        let reason: string | null = null;
        let done = false;
        for (let i = 0; i < steps.length && !done; i++) {
          const st = steps[i];
          const expectMb = secs > 0 ? Math.round(((st.br + 128_000) * secs) / 8 / MB) : null;
          const note = `${st.label} — من ${Math.round(file.size / MB)} ميجا${expectMb ? ` إلى نحو ${expectMb} ميجا` : ''}${i > 0 ? ' (محاولة بجودة أقل)' : ''}`;
          onStage('compressing', 0, note);
          let failure: string | null = null;
          const out = await transcodeVideo(
            file,
            p => onStage('compressing', Math.round(p), note),
            r => { failure = r; },
            { maxDurationSeconds: 3 * 60 * 60, videoBitrate: st.br, maxDimension: st.dim },
          );
          if (out && out.size < file.size && out.size <= limit) { body = out; done = true; break; }
          if (out && out.size < file.size && file.size <= limit) { body = out; done = true; break; }
          reason = out ? 'not-smaller' : failure;
          // Only these two are worth another try at a lower size; anything else (a codec
          // this browser cannot read, a broken file) fails the same way at every size.
          if (reason !== 'not-smaller' && !(out && out.size > limit)) break;
        }
        if (!done) {
          const why: Record<string, string> = {
            'no-video-track': 'ترميز الفيديو لا يقرؤه هذا المتصفح (غالباً HEVC / H.265) — صدّره بترميز H.264 من برنامج المونتاج',
            'unreadable': 'تعذّرت قراءة الملف — قد يكون تالفاً أو بصيغة غير مدعومة',
            'too-long': 'الفيديو أطول من 3 ساعات',
            'unsupported-browser': 'هذا المتصفح لا يستطيع ترميز الفيديو — افتح الأدمن من كروم أو إيدج على الكمبيوتر',
            'not-smaller': 'الفيديو مضغوط أصلاً ولم يصغر أكثر حتى بجودة 360p',
          };
          const msg = why[reason ?? ''] ?? `تعذّر الضغط${reason ? ` (${reason})` : ''}`;
          if (file.size > limit) return { error: `${msg}. وحجمه ${Math.round(file.size / MB)} ميجا والحد ${MAX_UPLOAD_MB} ميجا` };
          onStage('compressing', 100, `${msg} — يُرفع الأصل`);
        }
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
