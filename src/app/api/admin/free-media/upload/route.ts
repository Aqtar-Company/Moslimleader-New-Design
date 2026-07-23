export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getAuthUser } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'mp3' | 'image' | 'pdf' | 'cover'

    if (!file) return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (type === 'mp3') {
      const ALLOWED_AUDIO = ['mp3', 'ogg', 'wav', 'm4a'];
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
      if (!ALLOWED_AUDIO.includes(ext)) {
        return NextResponse.json({ error: 'امتداد الصوت غير مدعوم (mp3, ogg, wav, m4a)' }, { status: 400 });
      }
      const dir = path.join(process.cwd(), 'public', 'free-media', 'audio');
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, filename), buffer);
      return NextResponse.json({ url: `/free-media/audio/${filename}` });

    } else if (type === 'pdf') {
      if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
        return NextResponse.json({ error: 'الملف ليس PDF صحيحاً' }, { status: 400 });
      }
      const dir = path.join(process.cwd(), 'public', 'free-media', 'pdfs');
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}.pdf`;
      await writeFile(path.join(dir, filename), buffer);
      return NextResponse.json({ url: `/free-media/pdfs/${filename}` });

    } else {
      // image or cover
      const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        return NextResponse.json({ error: 'امتداد الصورة غير مدعوم' }, { status: 400 });
      }
      const subdir = type === 'cover' ? 'covers' : 'images';
      const dir = path.join(process.cwd(), 'public', 'free-media', subdir);
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, filename), buffer);
      return NextResponse.json({ url: `/free-media/${subdir}/${filename}` });
    }
  } catch (err) {
    console.error('[admin free-media upload]', err);
    return NextResponse.json({ error: 'فشل رفع الملف' }, { status: 500 });
  }
}
