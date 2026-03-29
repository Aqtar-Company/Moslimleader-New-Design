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
      // Save PDF to private/books/
      const dir = path.join(process.cwd(), 'private', 'books');
      await mkdir(dir, { recursive: true });
      const filename = `${randomUUID()}.pdf`;
      await writeFile(path.join(dir, filename), buffer);
      return NextResponse.json({ path: filename, type: 'pdf' });
    } else {
      // Save cover image to public/covers/
      const dir = path.join(process.cwd(), 'public', 'covers');
      await mkdir(dir, { recursive: true });
      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, filename), buffer);
      return NextResponse.json({ path: `/covers/${filename}`, type: 'cover' });
    }
  } catch (err) {
    console.error('[admin books upload]', err);
    return NextResponse.json({ error: 'فشل رفع الملف' }, { status: 500 });
  }
}
