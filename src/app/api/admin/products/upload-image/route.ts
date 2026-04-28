export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// POST /api/admin/products/upload-image
// Compresses and converts to WebP, max 1200px wide
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

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

    const dir = path.join(process.cwd(), 'public', 'products');
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}.webp`;

    const optimized = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    await writeFile(path.join(dir, filename), optimized);

    const savedKB = Math.round((buffer.length - optimized.length) / 1024);

    return NextResponse.json({
      url: `/products/${filename}`,
      originalSize: `${Math.round(buffer.length / 1024)}KB`,
      optimizedSize: `${Math.round(optimized.length / 1024)}KB`,
      saved: savedKB > 0 ? `${savedKB}KB` : '0KB',
    });
  } catch (err) {
    console.error('[admin products upload-image]', err);
    return NextResponse.json({ error: 'فشل رفع الصورة' }, { status: 500 });
  }
}
