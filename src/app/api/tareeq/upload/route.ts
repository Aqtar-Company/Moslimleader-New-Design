export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '@/lib/r2';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
const MAX_IMAGE = 10 * 1024 * 1024;  // 10MB
// 50MB, NOT because the app cannot handle more — because nginx on this server caps the
// request body at 50M (`/etc/nginx/conf.d/uploads.conf`, a bare directive in the http
// block, so it is the default for every site here that does not override it, moslimleader
// included). A larger limit here would be a lie: nginx rejects the request with 413 before
// this file ever runs, and the uploader sees a bare failure after sending 60MB.
// To raise it, add `client_max_body_size 100M;` inside the moslimleader server block ONLY
// (not to uploads.conf, which would raise it for the other projects on this box too), then
// change this and MAX_VIDEO_BYTES in TareeqCreateModal.tsx to match.
/**
 * Raised ONLY together with nginx. Default 50MB, which is what nginx allows today.
 *
 * The number lives in an env var so the app cannot be raised past nginx by accident: a
 * larger value here without the matching `client_max_body_size` is a lie — nginx answers
 * 413 before this file runs, after the phone has already sent the whole video, and the
 * uploader sees a bare failure. Set NEXT_PUBLIC_TAREEQ_MAX_VIDEO_MB only after adding
 * `client_max_body_size <same>M;` inside the moslimleader server block (NOT uploads.conf,
 * which is the http-level default for the other projects on this box too).
 */
const MAX_VIDEO_MB = Number(process.env.NEXT_PUBLIC_TAREEQ_MAX_VIDEO_MB) || 50;
const MAX_VIDEO = MAX_VIDEO_MB * 1024 * 1024;
const MAX_AUDIO = 20 * 1024 * 1024;  // 20MB


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

  const baseType = file.type.split(';')[0].trim(); // strip codec params e.g. 'audio/webm;codecs=opus'
  const isImage = ALLOWED_IMAGE.includes(baseType);
  const isVideo = ALLOWED_VIDEO.includes(baseType);
  const isAudio = ALLOWED_AUDIO.includes(baseType);
  if (!isImage && !isVideo && !isAudio) return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 });

  const maxSize = isImage ? MAX_IMAGE : isAudio ? MAX_AUDIO : MAX_VIDEO;
  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024);
    return NextResponse.json({ error: `الحجم الأقصى ${mb}MB` }, { status: 400 });
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
  } else if (isAudio) {
    const ext = baseType.includes('ogg') ? 'ogg' : baseType.includes('mpeg') ? 'mp3' : baseType.includes('wav') ? 'wav' : baseType.includes('mp4') ? 'm4a' : 'webm';
    key = `tareeq/audio/${auth.userId}-${timestamp}.${ext}`;
    fileData = raw;
    contentType = baseType; // strip codec params — 'audio/webm;codecs=opus' → 'audio/webm'
  } else {
    const ext = baseType.split('/')[1].replace('quicktime', 'mov');
    key = `tareeq/${auth.userId}-${timestamp}.${ext}`;
    fileData = raw;
    contentType = baseType;
  }

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: fileData,
    ContentType: contentType,
  }));

  const publicUrl = process.env.R2_PUBLIC_URL!;
  const url = `${publicUrl}/${key}`;

  return NextResponse.json({ ok: true, url, type: isImage ? 'image' : isAudio ? 'audio' : 'video' });
}
