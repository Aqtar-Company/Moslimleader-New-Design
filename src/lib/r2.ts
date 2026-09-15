/**
 * The one R2 client for user media, shared by every route that stores a file.
 *
 * ## Why every upload goes here and not to `public/`
 *
 * The avatar and cover routes used to write into `public/uploads/avatars/` on the server's
 * disk and store `/uploads/avatars/<file>` in the database. That can never work on this
 * deployment: Next.js in production serves only the files that were in `public/` at BUILD
 * time, so a picture uploaded after the deploy answers 404 until the next `npm run build` —
 * and the directory is neither in the repo nor gitignored, so a fresh clone does not even
 * have it. A member who changed their photo saw a broken image with their own name spilling
 * out of the circle, on every card, for everyone.
 *
 * R2 has none of that: the object is public the instant it is written, survives deploys and
 * clones, and is what every other Tareeq upload (posts, covers, audio) already uses.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;
/** Public base, no trailing slash. */
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');

export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

export async function putToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
  return r2PublicUrl(key);
}

/**
 * The object key of a URL this bucket serves, or null for anything else — a legacy
 * `/uploads/...` disk path, another host, garbage. Query strings (`?v=…`) are ignored.
 */
export function r2KeyFromUrl(url: string | null | undefined): string | null {
  if (!url || !R2_PUBLIC_URL) return null;
  const clean = url.split('?')[0];
  if (!clean.startsWith(`${R2_PUBLIC_URL}/`)) return null;
  const key = clean.slice(R2_PUBLIC_URL.length + 1);
  return key || null;
}

/** Best-effort delete. A missing object or a refused request must not fail the caller. */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch { /* already gone, or not ours to delete */ }
}
