export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
    const id = parseInt(params.id);
    const body = await req.json();
    const { title, titleEn, type, url, coverUrl, description, descriptionEn, sortOrder, isPublished } = body;
    const item = await prisma.freeMedia.update({
      where: { id },
      data: {
        title,
        titleEn: titleEn || null,
        type,
        url,
        coverUrl: coverUrl || null,
        description: description || null,
        descriptionEn: descriptionEn || null,
        sortOrder: Number(sortOrder) || 0,
        isPublished: !!isPublished,
      },
    });
    return NextResponse.json({ item });
  } catch (err) {
    console.error('[admin free-media PUT]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
    const id = parseInt(params.id);
    const item = await prisma.freeMedia.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    // delete file from disk
    if (item.url) {
      try {
        await unlink(path.join(process.cwd(), 'public', item.url));
      } catch {}
    }
    if (item.coverUrl) {
      try {
        await unlink(path.join(process.cwd(), 'public', item.coverUrl));
      } catch {}
    }

    await prisma.freeMedia.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin free-media DELETE]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
