export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';

const VALID_TYPES = ['mp3', 'pdf', 'image'] as const;

function assertSafeFreeMediaPath(p: string | undefined | null) {
  if (!p) return;
  if (!p.startsWith('/free-media/') || p.includes('..')) {
    throw new Error('Invalid media path');
  }
}

async function unlinkSafe(filePath: string) {
  try {
    await unlink(filePath);
  } catch (e: any) {
    if (e?.code !== 'ENOENT') console.error('[free-media] unlink failed', filePath, e?.code);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 });

    const body = await req.json();
    const { title, titleEn, type, url, coverUrl, description, descriptionEn, sortOrder, isPublished } = body;

    if (type && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'نوع الوسيط غير صالح' }, { status: 400 });
    }
    try {
      assertSafeFreeMediaPath(url);
      assertSafeFreeMediaPath(coverUrl);
    } catch {
      return NextResponse.json({ error: 'مسار الملف غير صالح' }, { status: 400 });
    }

    // Delete old files from disk if URLs changed
    const existing = await prisma.freeMedia.findUnique({ where: { id } });
    if (existing) {
      if (url && existing.url && url !== existing.url) {
        await unlinkSafe(path.join(process.cwd(), 'public', existing.url));
      }
      if (coverUrl !== undefined && existing.coverUrl && coverUrl !== existing.coverUrl) {
        await unlinkSafe(path.join(process.cwd(), 'public', existing.coverUrl));
      }
    }

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
    if (isNaN(id)) return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 });

    const item = await prisma.freeMedia.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    if (item.url) {
      await unlinkSafe(path.join(process.cwd(), 'public', item.url));
    }
    if (item.coverUrl) {
      await unlinkSafe(path.join(process.cwd(), 'public', item.coverUrl));
    }

    await prisma.freeMedia.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin free-media DELETE]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
