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

// POST /api/admin/products/upload-image
// FormData: file (image)
// Returns: { url: '/products/uuid.jpg' }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'يجب أن يكون الملف صورة' }, { status: 400 });
    }

    const ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'];
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return NextResponse.json({ error: 'امتداد غير مدعوم' }, { status: 400 });
    }

    // Max 8MB per image
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'الصورة أكبر من 8MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const dir = path.join(process.cwd(), 'public', 'products');
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), buffer);

    return NextResponse.json({ url: `/products/${filename}` });
  } catch (err) {
    console.error('[admin products upload-image]', err);
    return NextResponse.json({ error: 'فشل رفع الصورة' }, { status: 500 });
  }
}
