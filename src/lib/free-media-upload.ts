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
  audio: '.mp3,.m4a,.ogg,.wav',
  video: '.mp4,.webm,.mov,.m4v',
  image: '.jpg,.jpeg,.png,.webp',
  pdf: '.pdf',
};

export function kindOfFile(file: File): MediaKind | null {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  for (const k of Object.keys(ACCEPT) as MediaKind[]) if (ACCEPT[k].split(',').includes(`.${ext}`)) return k;
  return null;
}

/** A title from a file name: «قصة_الأرنب-الصادق.mp3» → «قصة الأرنب الصادق». */
export function titleFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 190) || name;
}

export function readDuration(file: File, kind: MediaKind): Promise<number | null> {
  if (kind !== 'audio' && kind !== 'video') return Promise.resolve(null);
  return new Promise(resolve => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
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
export async function uploadCover(file: File | Blob, onProgress: (p: number) => void): Promise<string | null> {
  const asFile = file instanceof File ? file : new File([file], 'cover.jpg', { type: 'image/jpeg' });
  const small = await compressImage(asFile, { maxWidth: 1280, maxHeight: 1280, quality: 0.8 }).catch(() => asFile);
  const r = await uploadFile(small, 'cover', onProgress, 'cover.jpg');
  return r.url ?? null;
}

export async function prepareAndUpload(
  file: File,
  kind: MediaKind,
  onStage: (stage: UploadStage, pct: number, note?: string) => void,
): Promise<PreparedMedia | { error: string }> {
  onStage('measuring', 0);
  const durationSec = await readDuration(file, kind);
  const waveform = kind === 'audio' ? await computeWaveform(file) : null;

  let body: File = file;
  if (kind === 'video' && file.size > COMPRESS_VIDEO_OVER && canTranscodeWithWebCodecs()) {
    onStage('compressing', 0);
    const out = await transcodeVideo(file, p => onStage('compressing', Math.round(p)));
    if (out && out.size < file.size) body = out;
    else onStage('compressing', 100, 'تعذّر الضغط — يُرفع الأصل');
  }

  onStage('uploading', 0);
  const up = await uploadFile(body, KIND_TO_TYPE[kind], p => onStage('uploading', p));
  if (!up.url) return { error: up.error ?? 'فشل الرفع' };

  onStage('finishing', 100);
  let coverUrl: string | null = null;
  if (kind === 'image') coverUrl = up.thumbUrl ?? null;
  if (kind === 'video') {
    const local = URL.createObjectURL(body);
    const frames = await captureVideoFrames(local, 1).finally(() => URL.revokeObjectURL(local));
    if (frames[0]) coverUrl = await uploadCover(dataUrlToBlob(frames[0]), () => {});
  }

  return { url: up.url, coverUrl, previewUrl: up.previewUrl ?? null, durationSec, waveform };
}
