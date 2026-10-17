'use client';

import { useEffect, useRef, useState } from 'react';
import { compressImage } from '@/lib/compress-image';
import { captureVideoFrames } from '@/lib/tareeq-video-frames';

/**
 * Changing the cover of a video that is ALREADY published.
 *
 * The composer has always had a cover picker — frames from the file, or an uploaded image
 * — but once the post was out, the editor offered a title and the text and nothing else,
 * so a cover chosen in a hurry (or the automatic first frame, often black) was permanent.
 *
 * Two ways, same as the composer:
 *  - a frame from the video itself, read from storage. That needs the storage host to
 *    allow cross-origin reads (see `captureVideoFrames`); when it does not, the strip says
 *    so and the upload below still works.
 *  - an image from the device.
 *
 * Nothing is saved here. The new cover is uploaded and handed back as a URL; the editor's
 * «حفظ» is what writes it to the post, so «إلغاء» still means nothing changed.
 */
export default function TareeqVideoCoverPicker({ videoUrl, coverUrl, isRtl, onChange }: {
  videoUrl: string;
  /** The cover as it stands in the editor — the saved one, or one just picked. */
  coverUrl: string | null;
  isRtl: boolean;
  onChange: (url: string) => void;
}) {
  const [frames, setFrames] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void captureVideoFrames(videoUrl, 6, { crossOrigin: true }).then(list => { if (!cancelled) setFrames(list); });
    return () => { cancelled = true; };
  }, [videoUrl]);

  async function upload(file: File, tag: string) {
    setBusy(tag);
    setError(null);
    try {
      const compressed = await compressImage(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.82 });
      const form = new FormData();
      form.append('file', compressed);
      const res = await fetch('/api/tareeq/upload', { method: 'POST', credentials: 'include', body: form });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) onChange(String(d.url));
      else setError(d.error || (isRtl ? 'تعذّر رفع الغلاف، حاول مرة أخرى' : 'Could not upload the cover — try again'));
    } catch {
      setError(isRtl ? 'لا يوجد اتصال' : 'No connection');
    } finally {
      setBusy(null);
    }
  }

  async function pickFrame(dataUrl: string, i: number) {
    const blob = await (await fetch(dataUrl)).blob();
    await upload(new File([blob], 'cover.jpg', { type: 'image/jpeg' }), `frame-${i}`);
  }

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
      <p className="text-xs font-bold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'غلاف الفيديو' : 'Video cover'}</p>

      <div className="flex gap-3 items-start">
        <div className="shrink-0 rounded-lg overflow-hidden flex items-center justify-center" style={{ width: 120, aspectRatio: '16/9', background: '#000' }}>
          {coverUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-[10px] text-white/60">{isRtl ? 'بلا غلاف' : 'No cover'}</span>}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
            style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-primary)', border: '1px solid var(--tr-border-soft)' }}
          >
            {busy === 'file' ? (isRtl ? 'جارٍ الرفع…' : 'Uploading…') : (isRtl ? '🖼️ رفع صورة غلاف' : '🖼️ Upload a cover image')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f, 'file'); }}
          />
          {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
        </div>
      </div>

      <div>
        <p className="text-[11px] mb-1.5" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'أو اختر لقطة من الفيديو' : 'Or pick a frame from the video'}</p>
        {frames === null ? (
          <p className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'جارٍ استخراج اللقطات…' : 'Reading frames…'}</p>
        ) : frames.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl ? 'تعذّر قراءة لقطات من هذا الفيديو هنا — ارفع صورة بدلاً منها.' : 'Frames could not be read from this video here — upload an image instead.'}
          </p>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {frames.map((f, i) => (
              <button
                key={i}
                type="button"
                disabled={!!busy}
                onClick={() => void pickFrame(f, i)}
                className="shrink-0 rounded-md overflow-hidden relative disabled:opacity-60"
                style={{ width: 72, aspectRatio: '16/9', border: '2px solid var(--tr-border-soft)', background: '#000' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f} alt="" className="w-full h-full object-cover" />
                {busy === `frame-${i}` && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'rgba(0,0,0,0.55)' }}>…</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
