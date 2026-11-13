export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requirePerm } from '@/lib/permissions';
import { putToR2 } from '@/lib/r2';
import { LOGO_MAX_BYTES, LOGO_R2_PREFIX, sniffDesign } from '@/lib/logo-designs';

/**
 * POST multipart { file, kind } — kind:
 *  - `design`: the PRINT file (png / jpg / svg / pdf), stored exactly as uploaded. A raster
 *    file also gets a WebP preview (≤1200px, transparency kept) and its pixel size; an svg
 *    is its own preview; a pdf needs a picture uploaded as `preview`.
 *  - `preview`: a picture to show for a design (png / jpg / webp) → WebP ≤1200px.
 *  - `banner`: the page banner → WebP ≤1920px.
 */
export async function POST(req: NextRequest) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const kind = String(form.get('kind') ?? '');
    if (!file) return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });
    if (!['design', 'preview', 'banner'].includes(kind)) return NextResponse.json({ error: 'نوع الرفع غير معروف' }, { status: 400 });
    if (file.size > LOGO_MAX_BYTES) return NextResponse.json({ error: 'حجم الملف كبير جداً (40 MB كحد أقصى)' }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    const sniff = sniffDesign(buf);
    const raster = sniff && (sniff.ext === 'png' || sniff.ext === 'jpg' || sniff.ext === 'webp');
    if (!sniff || (kind === 'design' && sniff.ext === 'webp') || (kind !== 'design' && !raster)) {
      return NextResponse.json({
        error: kind === 'design'
          ? 'ملف التصميم لازم يكون PNG أو JPG أو SVG أو PDF'
          : 'الصورة لازم تكون PNG أو JPG أو WebP',
      }, { status: 400 });
    }

    const id = randomUUID();
    const sharp = (await import('sharp')).default;
    const webp = async (max: number) => {
      const { data, info } = await sharp(buf, { failOn: 'none' }).rotate()
        .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84, alphaQuality: 90 })
        .toBuffer({ resolveWithObject: true });
      return { data, info };
    };

    if (kind === 'banner') {
      const { data } = await webp(1920);
      return NextResponse.json({ url: await putToR2(`${LOGO_R2_PREFIX}banner/${id}.webp`, data, 'image/webp') });
    }
    if (kind === 'preview') {
      const { data } = await webp(1200);
      return NextResponse.json({ url: await putToR2(`${LOGO_R2_PREFIX}previews/${id}.webp`, data, 'image/webp') });
    }

    // The print file, as uploaded.
    const fileUrl = await putToR2(`${LOGO_R2_PREFIX}files/${id}.${sniff.ext}`, buf, sniff.contentType);
    let width: number | null = null, height: number | null = null, previewUrl: string | null = null;
    if (raster) {
      const meta = await sharp(buf, { failOn: 'none' }).metadata().catch(() => null);
      width = meta?.width ?? null;
      height = meta?.height ?? null;
      const p = await webp(1200).catch(() => null);
      if (p) previewUrl = await putToR2(`${LOGO_R2_PREFIX}previews/${id}.webp`, p.data, 'image/webp');
    } else if (sniff.ext === 'svg') {
      previewUrl = fileUrl;
    }
    return NextResponse.json({ fileUrl, fileType: sniff.ext, fileSize: buf.length, width, height, previewUrl });
  } catch (err) {
    console.error('[admin logo-designs upload]', err);
    return NextResponse.json({ error: 'فشل رفع الملف' }, { status: 500 });
  }
}
