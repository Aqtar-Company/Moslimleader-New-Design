export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { requirePerm } from '@/lib/permissions';

// POST /api/admin/products/upload-image
// Compresses and converts to WebP, max 1200px wide
export async function POST(req: NextRequest) {
  try {
    const guard = await requirePerm('products.write');
    if ('response' in guard) return guard.response;

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'يجب أن يكون الملف صورة' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'الصورة أكبر من 10MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate actual image content via sharp — catches spoofed Content-Type
    let sharpInstance: ReturnType<typeof sharp>;
    try {
      sharpInstance = sharp(buffer);
      const meta = await sharpInstance.metadata();
      const allowed = ['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff'];
      if (!meta.format || !allowed.includes(meta.format)) {
        return NextResponse.json({ error: 'صيغة الصورة غير مدعومة' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'الملف ليس صورة صالحة' }, { status: 400 });
    }

    const dir = path.join(process.cwd(), 'public', 'products');
    await mkdir(dir, { recursive: true });

    const uid = randomUUID();
    const filename = `${uid}.webp`;
    const thumbFilename = `${uid}-thumb.webp`;

    const [optimized, thumbnail] = await Promise.all([
      sharpInstance
        .clone()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer(),
      sharpInstance
        .clone()
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 65 })
        .toBuffer(),
    ]);

    await Promise.all([
      writeFile(path.join(dir, filename), optimized),
      writeFile(path.join(dir, thumbFilename), thumbnail),
    ]);

    const savedKB = Math.round((buffer.length - optimized.length) / 1024);

    return NextResponse.json({
      url: `/products/${filename}`,
      thumbUrl: `/products/${thumbFilename}`,
      originalSize: `${Math.round(buffer.length / 1024)}KB`,
      optimizedSize: `${Math.round(optimized.length / 1024)}KB`,
      saved: savedKB > 0 ? `${savedKB}KB` : '0KB',
    });
  } catch (err) {
    console.error('[admin products upload-image]', err);
    return NextResponse.json({ error: 'فشل رفع الصورة' }, { status: 500 });
  }
}
