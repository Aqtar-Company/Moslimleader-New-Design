export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// PUT /api/admin/books/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    const book = await prisma.book.update({
      where: { id },
      data: { ...body, updatedAt: new Date() },
    });

    return NextResponse.json({ book });
  } catch (err) {
    console.error('[admin books PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE /api/admin/books/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id } = await params;
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });

    // Delete PDF file if exists
    if (book.filePath) {
      try {
        await unlink(path.join(process.cwd(), 'private', 'books', book.filePath));
      } catch { /* file may not exist */ }
    }

    await prisma.book.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin books DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
