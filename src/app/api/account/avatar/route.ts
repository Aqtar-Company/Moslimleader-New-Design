export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { putToR2, r2KeyFromUrl, deleteFromR2 } from '@/lib/r2';

/**
 * Profile picture upload.
 *
 * Stored on R2 like every other user upload. This route used to write to
 * `public/uploads/avatars/` on disk, which production Next.js does not serve for files
 * added after the build — so every new photo was a broken image. See `src/lib/r2.ts`.
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function processImage(buffer: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(buffer)
      .rotate() // honour EXIF orientation — a phone photo is often stored sideways
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 88, progressive: true })
      .toBuffer();
  } catch {
    // sharp not available — use raw buffer
    return buffer;
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });

  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'لا يوجد ملف' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'الحجم الأقصى 5MB' }, { status: 400 });

  const raw = Buffer.from(await file.arrayBuffer());
  const data = await processImage(raw);

  // A timestamp in the KEY, not a `?v=` on a fixed name: a new object per upload means no
  // browser, CDN or service-worker cache can ever show the previous photo.
  const key = `avatars/${auth.userId}-${Date.now()}.jpg`;
  let avatarUrl: string;
  try {
    avatarUrl = await putToR2(key, data, 'image/jpeg');
  } catch (e) {
    console.error('[avatar] R2 upload failed', e);
    return NextResponse.json({ error: 'تعذّر حفظ الصورة، حاول تاني' }, { status: 502 });
  }

  const prev = await prisma.user.findUnique({ where: { id: auth.userId }, select: { avatarUrl: true } });
  await prisma.user.update({ where: { id: auth.userId }, data: { avatarUrl } });

  // The old object is only removed AFTER the row points at the new one, so a failure in
  // between never leaves the profile with no picture at all.
  const oldKey = r2KeyFromUrl(prev?.avatarUrl);
  if (oldKey && oldKey !== key) void deleteFromR2(oldKey);

  return NextResponse.json({ ok: true, avatarUrl });
}

export async function DELETE() {
  const auth = await getAuthUser().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { avatarUrl: true } });
  await prisma.user.update({ where: { id: auth.userId }, data: { avatarUrl: null } });

  const key = r2KeyFromUrl(user?.avatarUrl);
  if (key) void deleteFromR2(key);
  // A legacy `/uploads/...` disk path is simply dropped; nothing served it anyway.

  return NextResponse.json({ ok: true });
}
