export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// POST /api/admin/books/upload — upload PDF or cover image
// FormData fields: file (File), type ('pdf' | 'cover')
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'pdf' | 'cover'

    if (!file) return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (type === 'pdf') {
      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'يجب أن يكون الملف بصيغة PDF' }, { status: 400 });
      }
      // Verify PDF magic bytes (%PDF-)
      if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
        return NextResponse.json({ error: 'الملف ليس PDF صحيحاً' }, { status: 400 });
      }
      const dir = path.join(process.cwd(), 'private', 'books');
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}.pdf`;
      await writeFile(path.join(dir, filename), buffer);
      return NextResponse.json({ path: filename, type: 'pdf' });
    } else if (type === 'audio') {
      const ALLOWED_AUDIO = ['mp3', 'ogg', 'wav', 'm4a'];
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
      if (!ALLOWED_AUDIO.includes(ext)) {
        return NextResponse.json({ error: 'امتداد الصوت غير مدعوم (mp3, ogg, wav, m4a)' }, { status: 400 });
      }
      const dir = path.join(process.cwd(), 'public', 'audio');
      await mkdir(dir, { recursive: true });
      const audioId = randomUUID();
      const audioFilename = audioId + '.' + ext;
      await writeFile(path.join(dir, audioFilename), buffer);
      return NextResponse.json({ path: '/audio/' + audioFilename, type: 'audio' });
    } else {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'يجب أن تكون الغلاف صورة (jpg, png, webp...)' }, { status: 400 });
      }
      const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        return NextResponse.json({ error: 'امتداد الصورة غير مدعوم' }, { status: 400 });
      }
      const dir = path.join(process.cwd(), 'public', 'covers');
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, filename), buffer);
      return NextResponse.json({ path: `/covers/${filename}`, type: 'cover' });
    }
  } catch (err) {
    console.error('[admin books upload]', err);
    return NextResponse.json({ error: 'فشل رفع الملف' }, { status: 500 });
  }
}
