export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO = 100 * 1024 * 1024; // 100MB

async function compressImageBuffer(buffer: Buffer): Promise<{ data: Buffer; ext: string }> {
  try {
    const sharp = (await import('sharp')).default;
    const data = await sharp(buffer)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();
    // Use compressed only if it saved space
    return { data: data.length < buffer.length ? data : buffer, ext: 'jpg' };
  } catch {
    return { data: buffer, ext: 'jpg' };
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-upload:${auth.userId}:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });

  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'لا يوجد ملف' }, { status: 400 });

  const isImage = ALLOWED_IMAGE.includes(file.type);
  const isVideo = ALLOWED_VIDEO.includes(file.type);
  if (!isImage && !isVideo) return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 });

  const maxSize = isImage ? MAX_IMAGE : MAX_VIDEO;
  if (file.size > maxSize) {
    return NextResponse.json({ error: isImage ? 'الحجم الأقصى 10MB' : 'الحجم الأقصى 100MB' }, { status: 400 });
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const timestamp = Date.now();

  let filename: string;
  let fileData: Buffer;

  if (isImage) {
    const { data, ext } = await compressImageBuffer(raw);
    filename = `${auth.userId}-${timestamp}.${ext}`;
    fileData = data;
  } else {
    const ext = file.type.split('/')[1].replace('quicktime', 'mov');
    filename = `${auth.userId}-${timestamp}.${ext}`;
    fileData = raw;
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tareeq');
  await mkdir(uploadDir, { recursive: true });
  const dest = path.join(uploadDir, filename);
  await writeFile(dest, fileData);
  const url = `/uploads/tareeq/${filename}`;

  return NextResponse.json({ ok: true, url, type: isImage ? 'image' : 'video' });
}
