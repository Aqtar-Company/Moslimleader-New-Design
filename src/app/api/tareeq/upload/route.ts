export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO = 100 * 1024 * 1024; // 100MB

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function compressImageBuffer(buffer: Buffer): Promise<{ data: Buffer; ext: string }> {
  try {
    const sharp = (await import('sharp')).default;
    const data = await sharp(buffer)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();
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

  let key: string;
  let fileData: Buffer;
  let contentType: string;

  if (isImage) {
    const { data, ext } = await compressImageBuffer(raw);
    key = `tareeq/${auth.userId}-${timestamp}.${ext}`;
    fileData = data;
    contentType = 'image/jpeg';
  } else {
    const ext = file.type.split('/')[1].replace('quicktime', 'mov');
    key = `tareeq/${auth.userId}-${timestamp}.${ext}`;
    fileData = raw;
    contentType = file.type;
  }

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: fileData,
    ContentType: contentType,
  }));

  const publicUrl = process.env.R2_PUBLIC_URL!;
  const url = `${publicUrl}/${key}`;

  return NextResponse.json({ ok: true, url, type: isImage ? 'image' : 'video' });
}
