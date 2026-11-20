export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import sharp from 'sharp';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { putToR2 } from '@/lib/r2';
import { checkRateLimit } from '@/lib/rate-limit';
import { warmShareImage } from '@/lib/share-image';

/**
 * POST /api/badge/share — body: the finished badge picture (image/jpeg, ≤ 4 MB).
 *
 * Called only when a member shares from a computer, where neither WhatsApp nor Facebook can
 * be handed a file. The picture is re-encoded (which also strips EXIF/GPS), stored on R2, and
 * gets a short link /b/<id> whose preview IS the picture. Answers { url }.
 */
const MAX_BYTES = 4 * 1024 * 1024;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const newId = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export async function POST(req: NextRequest) {
  const auth = await getAuthUser().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'سجّل دخولك أولاً' }, { status: 401 });

  const rl = checkRateLimit(`badge-share:${auth.userId}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول بعد قليل' }, { status: 429 });

  try {
    const raw = Buffer.from(await req.arrayBuffer());
    if (!raw.length || raw.length > MAX_BYTES) return NextResponse.json({ error: 'حجم الصورة غير مناسب' }, { status: 413 });

    // Judge it by its bytes, and keep only a clean square JPEG.
    let jpeg: Buffer;
    try {
      jpeg = await sharp(raw).rotate().resize(1080, 1080, { fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    } catch {
      return NextResponse.json({ error: 'الملف ليس صورة' }, { status: 400 });
    }

    const id = newId();
    const imageUrl = await putToR2(`badge-shares/${auth.userId}/${Date.now()}-${id}.jpg`, jpeg, 'image/jpeg');
    await prisma.badgeShare.create({ data: { id, userId: auth.userId, imageUrl } });
    // Prepare the preview copy now, so the first crawler that asks gets it at once.
    warmShareImage(imageUrl);

    return NextResponse.json({ url: `https://moslimleader.com/b/${id}` });
  } catch (err) {
    console.error('[badge share]', err);
    return NextResponse.json({ error: 'تعذّر تجهيز الرابط' }, { status: 500 });
  }
}
