export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { putToR2, r2KeyFromUrl, deleteFromR2 } from '@/lib/r2';

/**
 * Profile cover upload. Same story as the avatar route: it wrote to `public/uploads/`
 * on disk, which production Next.js never served for files added after the build.
 * See `src/lib/r2.ts`.
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024; // 8MB

async function processImage(buffer: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(buffer)
      .rotate()
      // 3:1, and the profile pages draw the cover box at 3:1 too, so the whole picture the
      // member chose is visible on every width instead of being cropped to a fixed height.
      .resize(1500, 500, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
  } catch {
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
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'الحجم الأقصى 8MB' }, { status: 400 });

  const raw = Buffer.from(await file.arrayBuffer());
  const data = await processImage(raw);

  const key = `covers/${auth.userId}-${Date.now()}.jpg`;
  let coverUrl: string;
  try {
    coverUrl = await putToR2(key, data, 'image/jpeg');
  } catch (e) {
    console.error('[cover] R2 upload failed', e);
    return NextResponse.json({ error: 'تعذّر حفظ الغلاف، حاول تاني' }, { status: 502 });
  }

  const prev = await prisma.user.findUnique({ where: { id: auth.userId }, select: { coverUrl: true } });
  await prisma.user.update({ where: { id: auth.userId }, data: { coverUrl } });

  const oldKey = r2KeyFromUrl(prev?.coverUrl);
  if (oldKey && oldKey !== key) void deleteFromR2(oldKey);

  return NextResponse.json({ ok: true, coverUrl });
}

export async function DELETE() {
  const auth = await getAuthUser().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { coverUrl: true } });
  await prisma.user.update({ where: { id: auth.userId }, data: { coverUrl: null } });

  const key = r2KeyFromUrl(user?.coverUrl);
  if (key) void deleteFromR2(key);

  return NextResponse.json({ ok: true });
}
