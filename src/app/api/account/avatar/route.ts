export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function processImage(buffer: Buffer): Promise<{ data: Buffer; ext: string }> {
  try {
    const sharp = (await import('sharp')).default;
    const data = await sharp(buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 88, progressive: true })
      .toBuffer();
    return { data, ext: 'jpg' };
  } catch {
    // sharp not available — use raw buffer
    return { data: buffer, ext: 'jpg' };
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
  const { data, ext } = await processImage(raw);

  const filename = `${auth.userId}.${ext}`;
  const dest = path.join(process.cwd(), 'public', 'uploads', 'avatars', filename);

  await writeFile(dest, data);
  // Append a version timestamp so browsers don't serve a stale cached copy
  // after the user uploads a new photo to the same filename.
  const avatarUrl = `/uploads/avatars/${filename}?v=${Date.now()}`;

  await prisma.user.update({ where: { id: auth.userId }, data: { avatarUrl } });

  return NextResponse.json({ ok: true, avatarUrl });
}

export async function DELETE() {
  const auth = await getAuthUser().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { avatarUrl: true } });
  if (user?.avatarUrl) {
    // Strip query params (e.g. ?v=timestamp) before building the file path
    const cleanPath = user.avatarUrl.split('?')[0];
    const filePath = path.join(process.cwd(), 'public', cleanPath);
    await unlink(filePath).catch(() => {});
  }

  await prisma.user.update({ where: { id: auth.userId }, data: { avatarUrl: null } });
  return NextResponse.json({ ok: true });
}
