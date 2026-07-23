export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getAuthUser } from '@/lib/jwt';

const MAX_AUDIO_BYTES = 150 * 1024 * 1024; // 150 MB
const MAX_PDF_BYTES   =  50 * 1024 * 1024; //  50 MB
const MAX_IMAGE_BYTES =   5 * 1024 * 1024; //   5 MB

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

    if (type === 'mp3') {
      if (file.size > MAX_AUDIO_BYTES) {
        return NextResponse.json({ error: 'حجم الملف كبير جداً (150 MB كحد أقصى)' }, { status: 413 });
      }
      const ALLOWED_AUDIO = ['mp3', 'ogg', 'wav', 'm4a'];
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
      if (!ALLOWED_AUDIO.includes(ext)) {
        return NextResponse.json({ error: 'امتداد الصوت غير مدعوم (mp3, ogg, wav, m4a)' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Verify audio magic bytes
      const isMP3 = (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) || // MPEG sync word
                    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33); // ID3 header
      const isOGG = buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53;
      const isWAV = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      const isM4A = buffer.length > 7 &&
                    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
      if (ext === 'mp3' && !isMP3) {
        return NextResponse.json({ error: 'محتوى الملف لا يتوافق مع الامتداد' }, { status: 400 });
      }
      if (ext === 'ogg' && !isOGG) {
        return NextResponse.json({ error: 'محتوى الملف لا يتوافق مع الامتداد' }, { status: 400 });
      }
      if (ext === 'wav' && !isWAV) {
        return NextResponse.json({ error: 'محتوى الملف لا يتوافق مع الامتداد' }, { status: 400 });
      }
      if (ext === 'm4a' && !isM4A) {
        return NextResponse.json({ error: 'محتوى الملف لا يتوافق مع الامتداد' }, { status: 400 });
      }

      const dir = path.join(process.cwd(), 'public', 'free-media', 'audio');
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, filename), buffer);
      return NextResponse.json({ url: `/free-media/audio/${filename}` });

    } else if (type === 'pdf') {
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: 'حجم الملف كبير جداً (50 MB كحد أقصى)' }, { status: 413 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

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
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'حجم الصورة كبير جداً (5 MB كحد أقصى)' }, { status: 413 });
      }
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'يجب أن تكون الغلاف صورة (jpg, png, webp...)' }, { status: 400 });
      }
      const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        return NextResponse.json({ error: 'امتداد الصورة غير مدعوم' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Verify image magic bytes
      const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
      const isPng  = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      const isWebp = buffer.length > 11 &&
                     buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                     buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
      const isAvif = buffer.length > 11 &&
                     buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
      if (['jpg', 'jpeg'].includes(ext) && !isJpeg) {
        return NextResponse.json({ error: 'محتوى الملف لا يتوافق مع الامتداد' }, { status: 400 });
      }
      if (ext === 'png' && !isPng) {
        return NextResponse.json({ error: 'محتوى الملف لا يتوافق مع الامتداد' }, { status: 400 });
      }
      if (ext === 'webp' && !isWebp) {
        return NextResponse.json({ error: 'محتوى الملف لا يتوافق مع الامتداد' }, { status: 400 });
      }
      if (ext === 'avif' && !isAvif) {
        return NextResponse.json({ error: 'محتوى الملف لا يتوافق مع الامتداد' }, { status: 400 });
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
