export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import path from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { isAllowedMediaRef, readStoredMedia } from '@/lib/free-media';

/**
 * GET /api/media/thumb?u=<cover url>&w=<160|320|640>
 *
 * A small WebP of a media-library picture, for the places that show it small: grid cards,
 * the playlist, the share sheet. Covers are stored at up to 1280px (~150 KB each) and the
 * site runs with `images.unoptimized`, so /media used to download ~20 of them at full size
 * for 56–300px slots — 3 MB of pictures on one page view, on a phone.
 *
 * Each (url, width) is resized ONCE with sharp and kept on disk in `.cache/media-thumbs/`
 * (gitignored, outside `public/`, survives deploys), then served with a year's cache —
 * safe because every stored object has a unique key, so a new picture is a new URL.
 * Only this library's own files are accepted (`isAllowedMediaRef`), so this is not an open
 * image proxy. On any failure it redirects to the original, so a picture never breaks.
 */
const WIDTHS = new Set([160, 320, 640]);
const DIR = path.join(process.cwd(), '.cache', 'media-thumbs');
const inflight = new Map<string, Promise<Buffer | null>>();

async function make(u: string, w: number, file: string): Promise<Buffer | null> {
  const src = await readStoredMedia(u);
  if (!src) return null;
  const sharp = (await import('sharp')).default;
  const out = await sharp(src, { failOn: 'none' })
    .rotate()
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  await mkdir(DIR, { recursive: true }).catch(() => {});
  await writeFile(file, out).catch(() => {});
  return out;
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') ?? '';
  const w = Number(req.nextUrl.searchParams.get('w'));
  if (!u || !isAllowedMediaRef(u) || !WIDTHS.has(w)) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const hash = createHash('sha1').update(`${w}|${u}`).digest('hex');
  const file = path.join(DIR, `${hash}.webp`);
  let buf: Buffer | null = await readFile(file).catch(() => null);
  if (!buf) {
    let job = inflight.get(hash);
    if (!job) {
      job = make(u, w, file).catch(err => { console.error('[media-thumb]', err?.message ?? err); return null; });
      inflight.set(hash, job);
      void job.finally(() => inflight.delete(hash));
    }
    buf = await job;
  }
  if (!buf) {
    const target = u.startsWith('/') ? new URL(u, req.nextUrl.origin) : new URL(u);
    return NextResponse.redirect(target, 302);
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(buf.length),
    },
  });
}
