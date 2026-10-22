export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requirePerm } from '@/lib/permissions';
import { putToR2 } from '@/lib/r2';
import { R2_MEDIA_PREFIX, compressCover, drawingPreview, drawingThumb } from '@/lib/free-media';

/**
 * Upload one file for the media library. Everything goes to R2 — see src/lib/free-media.ts
 * for why `public/` cannot hold a file uploaded after the build.
 *
 * `type`: 'mp3' (audio) | 'video' | 'pdf' | 'image' (a drawing) | 'cover' (a thumbnail).
 *
 * The video limit is the SAME number nginx enforces for this site
 * (`NEXT_PUBLIC_TAREEQ_MAX_VIDEO_MB`, see CLAUDE.md): a larger limit here would be a lie,
 * because nginx answers 413 before this route runs.
 */
const MB = 1024 * 1024;
const MAX_VIDEO_MB = Number(process.env.NEXT_PUBLIC_TAREEQ_MAX_VIDEO_MB) || 50;
const LIMITS: Record<string, number> = {
  mp3: 150 * MB,
  video: MAX_VIDEO_MB * MB,
  pdf: 50 * MB,
  image: 15 * MB,
  cover: 5 * MB,
};

type Sniff = { ext: string; contentType: string } | null;

function sniffAudio(b: Buffer, ext: string): Sniff {
  const isMP3 = (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) || (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33);
  const isOGG = b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53;
  const isWAV = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
  const isFtyp = b.length > 7 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
  if (ext === 'mp3' && isMP3) return { ext, contentType: 'audio/mpeg' };
  if (ext === 'ogg' && isOGG) return { ext, contentType: 'audio/ogg' };
  if (ext === 'wav' && isWAV) return { ext, contentType: 'audio/wav' };
  if (ext === 'm4a' && isFtyp) return { ext, contentType: 'audio/mp4' };
  return null;
}

function sniffVideo(b: Buffer, ext: string): Sniff {
  const isFtyp = b.length > 7 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
  const isWebm = b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3;
  if ((ext === 'mp4' || ext === 'm4v') && isFtyp) return { ext: 'mp4', contentType: 'video/mp4' };
  if (ext === 'mov' && isFtyp) return { ext, contentType: 'video/quicktime' };
  if (ext === 'webm' && isWebm) return { ext, contentType: 'video/webm' };
  return null;
}

function sniffImage(b: Buffer, ext: string): Sniff {
  const isJpeg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  const isWebp = b.length > 11 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  const isAvif = b.length > 11 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
  if ((ext === 'jpg' || ext === 'jpeg') && isJpeg) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (ext === 'png' && isPng) return { ext, contentType: 'image/png' };
  if (ext === 'webp' && isWebp) return { ext, contentType: 'image/webp' };
  if (ext === 'avif' && isAvif) return { ext, contentType: 'image/avif' };
  return null;
}

const FOLDER: Record<string, string> = { mp3: 'audio', video: 'video', pdf: 'pdfs', image: 'images', cover: 'covers' };

export async function POST(req: NextRequest) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = String(formData.get('type') ?? '');
    if (!file) return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });
    if (!(type in LIMITS)) return NextResponse.json({ error: 'نوع الرفع غير معروف' }, { status: 400 });
    if (file.size > LIMITS[type]) {
      return NextResponse.json({ error: `حجم الملف كبير جداً (${Math.round(LIMITS[type] / MB)} MB كحد أقصى)` }, { status: 413 });
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let sniff: Sniff = null;
    if (type === 'mp3') sniff = sniffAudio(buffer, ext);
    else if (type === 'video') sniff = sniffVideo(buffer, ext);
    else if (type === 'pdf') sniff = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 ? { ext: 'pdf', contentType: 'application/pdf' } : null;
    else sniff = sniffImage(buffer, ext);

    if (!sniff) {
      const allowed = type === 'mp3' ? 'mp3, m4a, ogg, wav' : type === 'video' ? 'mp4, webm, mov' : type === 'pdf' ? 'pdf' : 'jpg, png, webp';
      return NextResponse.json({ error: `الملف غير صالح أو امتداده لا يطابق محتواه (المسموح: ${allowed})` }, { status: 400 });
    }

    const id = randomUUID();

    // A cover is only ever shown small: store the compressed copy, never the original.
    if (type === 'cover') {
      const small = await compressCover(buffer).catch(() => null);
      const url = small
        ? await putToR2(`${R2_MEDIA_PREFIX}covers/${id}.jpg`, small, 'image/jpeg')
        : await putToR2(`${R2_MEDIA_PREFIX}covers/${id}.${sniff.ext}`, buffer, sniff.contentType);
      return NextResponse.json({ url });
    }

    const url = await putToR2(`${R2_MEDIA_PREFIX}${FOLDER[type]}/${id}.${sniff.ext}`, buffer, sniff.contentType);

    // A drawing keeps its original for download, plus a light copy to SHOW and a small
    // thumbnail for the grid. Failure here is not fatal: the original still works.
    if (type === 'image') {
      const [preview, thumb] = await Promise.all([
        drawingPreview(buffer).catch(() => null),
        drawingThumb(buffer).catch(() => null),
      ]);
      const previewUrl = preview ? await putToR2(`${R2_MEDIA_PREFIX}previews/${id}.webp`, preview, 'image/webp') : null;
      const thumbUrl = thumb ? await putToR2(`${R2_MEDIA_PREFIX}covers/${id}.jpg`, thumb, 'image/jpeg') : null;
      return NextResponse.json({ url, previewUrl, thumbUrl });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error('[admin free-media upload]', err);
    return NextResponse.json({ error: 'فشل رفع الملف' }, { status: 500 });
  }
}
