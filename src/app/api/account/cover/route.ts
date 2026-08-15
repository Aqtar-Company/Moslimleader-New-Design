export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024; // 8MB

async function processImage(buffer: Buffer): Promise<{ data: Buffer; ext: string }> {
  try {
    const sharp = (await import('sharp')).default;
    const data = await sharp(buffer)
      .resize(1200, 400, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    return { data, ext: 'jpg' };
  } catch {
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
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'الحجم الأقصى 8MB' }, { status: 400 });

  const raw = Buffer.from(await file.arrayBuffer());
  const { data, ext } = await processImage(raw);

  const filename = `cover-${auth.userId}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(path.join(dir, filename), data);

  const coverUrl = `/uploads/avatars/${filename}?v=${Date.now()}`;
  await prisma.user.update({ where: { id: auth.userId }, data: { coverUrl } });

  return NextResponse.json({ ok: true, coverUrl });
}

export async function DELETE() {
  const auth = await getAuthUser().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { coverUrl: true } });
  if (user?.coverUrl) {
    const cleanPath = user.coverUrl.split('?')[0];
    const filePath = path.join(process.cwd(), 'public', cleanPath);
    await unlink(filePath).catch(() => {});
  }

  await prisma.user.update({ where: { id: auth.userId }, data: { coverUrl: null } });
  return NextResponse.json({ ok: true });
}
