import { createHash } from 'crypto';
import path from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { R2_PUBLIC_URL } from '@/lib/r2';

/**
 * The picture a shared link carries (og:image), served from moslimleader.com instead of
 * the R2 development host.
 *
 * Uploaded pictures live at `https://pub-….r2.dev/…`. Cloudflare documents r2.dev as a
 * development address — rate-limited, no production guarantees — and Facebook's scraper
 * repeatedly failed on it: a طريق image post shared to Facebook showed only
 * «moslimleader.com» in a grey box, while the same tags served to curl were complete.
 * Three things change here:
 *  - the image is fetched once, resized to ≤1200px JPEG (sharp), kept on disk in
 *    `.cache/share-images/` (gitignored, survives deploys) and served from our domain;
 *  - its real width and height are known, so the preview can state og:image:width/height —
 *    Facebook's own guidance: without them the FIRST share is often rendered with no image,
 *    because the picture is processed asynchronously;
 *  - a 1254×1254, 475 KB original becomes ~150 KB.
 *
 * Only R2 objects are accepted (the URL must start with R2_PUBLIC_URL), so the route is
 * not an open image proxy. Anything else is returned unchanged by `shareImageUrl()`.
 */
const DIR = path.join(process.cwd(), '.cache', 'share-images');
const SITE = 'https://moslimleader.com';
const MAX_BYTES = 20 * 1024 * 1024;
const inflight = new Map<string, Promise<ShareImage | null>>();

export type ShareImage = { buf: Buffer; width: number; height: number };

export function isShareableSource(u: string | null | undefined): u is string {
  return !!u && !!R2_PUBLIC_URL && u.startsWith(`${R2_PUBLIC_URL}/`);
}

/** The og:image URL for a picture: ours for an R2 object, the original otherwise. */
export function shareImageUrl(src: string): string {
  return isShareableSource(src) ? `${SITE}/api/share-image?u=${encodeURIComponent(src)}` : src;
}

function keyOf(src: string) {
  return createHash('sha1').update(src).digest('hex');
}

async function build(src: string, hash: string): Promise<ShareImage | null> {
  const res = await fetch(src, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return null;
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return null;
  const input = Buffer.from(await res.arrayBuffer());
  if (input.length > MAX_BYTES) return null;
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  await mkdir(DIR, { recursive: true }).catch(() => {});
  await writeFile(path.join(DIR, `${hash}.jpg`), data).catch(() => {});
  await writeFile(path.join(DIR, `${hash}.json`), JSON.stringify({ w: info.width, h: info.height })).catch(() => {});
  return { buf: data, width: info.width, height: info.height };
}

/** The processed picture, from disk when it was made before. Null on any failure. */
export async function getShareImage(src: string): Promise<ShareImage | null> {
  if (!isShareableSource(src)) return null;
  const hash = keyOf(src);
  const [buf, meta] = await Promise.all([
    readFile(path.join(DIR, `${hash}.jpg`)).catch(() => null),
    readFile(path.join(DIR, `${hash}.json`), 'utf8').then(s => JSON.parse(s) as { w: number; h: number }).catch(() => null),
  ]);
  if (buf && meta) return { buf, width: meta.w, height: meta.h };
  let job = inflight.get(hash);
  if (!job) {
    job = build(src, hash).catch(err => { console.error('[share-image]', src, err?.message ?? err); return null; });
    inflight.set(hash, job);
    void job.finally(() => inflight.delete(hash));
  }
  return job;
}

/**
 * Width and height for the preview's tags, without ever making a crawler wait long: a
 * cached picture answers at once; a new one gets `waitMs` to be made (and is finished in
 * the background either way, so the next scrape has it).
 */
export async function shareImageSize(src: string, waitMs = 2500): Promise<{ width: number; height: number } | null> {
  if (!isShareableSource(src)) return null;
  const r = await Promise.race([
    getShareImage(src),
    new Promise<null>(resolve => setTimeout(() => resolve(null), waitMs)),
  ]);
  return r ? { width: r.width, height: r.height } : null;
}

/** Make the share picture ahead of time (after a post is published). Never throws. */
export function warmShareImage(src: string | null | undefined): void {
  if (isShareableSource(src)) void getShareImage(src).catch(() => {});
}
