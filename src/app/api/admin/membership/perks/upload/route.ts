export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import sharp from 'sharp';

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Images only' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Max 5MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate via sharp
  try {
    const meta = await sharp(buffer).metadata();
    const allowed = ['jpeg', 'png', 'webp', 'gif', 'avif'];
    if (!meta.format || !allowed.includes(meta.format)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
  }

  // Save to public/products/ — same gitignored directory used by product images
  const dir = path.join(process.cwd(), 'public', 'products');
  await mkdir(dir, { recursive: true });

  const filename = `perk-${randomUUID()}.webp`;
  const optimized = await sharp(buffer)
    .resize(900, 900, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  await writeFile(path.join(dir, filename), optimized);

  return NextResponse.json({ url: `/products/${filename}` });
}
