/**
 * Server half of the media library (`free-media-shared.ts` is the client-safe half).
 *
 * Files live in two places, and every caller must accept both:
 *  - legacy rows: `/free-media/...`, written to `public/` on the server's disk;
 *  - new uploads: R2, under the `free-media/` key prefix.
 * New files never go to disk: production Next.js serves only the `public/` files that
 * existed at BUILD time, so an upload written there after a deploy is a 404 until the next
 * build. R2 is public the moment the object is written.
 */
import { unlink } from 'fs/promises';
import path from 'path';
import { deleteFromR2, r2KeyFromUrl } from '@/lib/r2';
import { TYPE_TO_KIND, type MediaKind } from '@/lib/free-media-shared';

const R2_PREFIX = 'free-media/';

/** A file reference an admin may store on an item: ours, on disk or on R2, nothing else. */
export function isAllowedMediaRef(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.startsWith('/free-media/')) return !url.includes('..');
  const key = r2KeyFromUrl(url);
  return !!key && key.startsWith(R2_PREFIX) && !key.includes('..');
}

/** Best-effort removal of a file this library stored. Anything else is left alone. */
export async function removeStoredMedia(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const key = r2KeyFromUrl(url);
  if (key && key.startsWith(R2_PREFIX)) { await deleteFromR2(key); return; }
  if (url.startsWith('/free-media/') && !url.includes('..')) {
    try {
      await unlink(path.join(process.cwd(), 'public', url));
    } catch (e: unknown) {
      if ((e as { code?: string })?.code !== 'ENOENT') console.error('[free-media] unlink failed', url);
    }
  }
}

export const R2_MEDIA_PREFIX = R2_PREFIX;

export function kindOfType(type: string): MediaKind | null {
  return TYPE_TO_KIND[type] ?? null;
}

/** Fields a visitor may see. Never the sort order or the publish flag. */
export const PUBLIC_MEDIA_SELECT = {
  id: true, title: true, titleEn: true, type: true, url: true, coverUrl: true,
  description: true, descriptionEn: true, durationSec: true, viewCount: true,
  previewUrl: true, waveform: true,
  createdAt: true, categoryId: true,
  category: { select: { id: true, name: true, nameEn: true } },
} as const;

// ── compression ──────────────────────────────────────────────────────────────────────
//
// Pictures were stored exactly as uploaded: a 4 MB phone photo as a 300px thumbnail, a
// 6 MB scan as a drawing everybody had to download in full just to SEE it. sharp is
// already a dependency (Tareeq's uploads use it) and is cheap for stills — unlike video,
// where a server-side re-encode would hold the CPU for minutes (see CLAUDE.md).

async function sharpOf(buf: Buffer) {
  const sharp = (await import('sharp')).default;
  return sharp(buf, { failOn: 'none' }).rotate(); // honour EXIF orientation, then drop it
}

/** A thumbnail / cover: at most 1280px, JPEG ~q78. JPEG, not WebP, because WhatsApp and
 *  Facebook previews are made from the cover and older scrapers refuse WebP. */
export async function compressCover(buf: Buffer): Promise<Buffer> {
  const img = await sharpOf(buf);
  return img.resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 78, mozjpeg: true, progressive: true })
    .toBuffer();
}

/** A drawing's display copy: 1400px wide at most, WebP. The original stays for download. */
export async function drawingPreview(buf: Buffer): Promise<Buffer> {
  const img = await sharpOf(buf);
  return img.resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 80 })
    .toBuffer();
}

/** A drawing's grid thumbnail: 600px, JPEG. */
export async function drawingThumb(buf: Buffer): Promise<Buffer> {
  const img = await sharpOf(buf);
  return img.resize(600, 600, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();
}

/** The bytes of a stored file, from disk (legacy) or R2. Null when unreachable. */
export async function readStoredMedia(url: string): Promise<Buffer | null> {
  if (!isAllowedMediaRef(url)) return null;
  if (url.startsWith('/free-media/')) {
    const { readFile } = await import('fs/promises');
    return readFile(path.join(process.cwd(), 'public', url)).catch(() => null);
  }
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
