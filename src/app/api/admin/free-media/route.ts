export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

const VALID_TYPES = ['mp3', 'pdf', 'image'] as const;

function assertSafeFreeMediaPath(p: string | undefined | null) {
  if (!p) return;
  if (!p.startsWith('/free-media/') || p.includes('..')) {
    throw new Error('Invalid media path');
  }
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
    const items = await prisma.freeMedia.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[admin free-media GET]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
    const body = await req.json();
    const { title, titleEn, type, url, coverUrl, description, descriptionEn, sortOrder, isPublished } = body;
    if (!title || !type || !url) {
      return NextResponse.json({ error: 'العنوان والنوع والملف مطلوبون' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'نوع الوسيط غير صالح' }, { status: 400 });
    }
    try {
      assertSafeFreeMediaPath(url);
      assertSafeFreeMediaPath(coverUrl);
    } catch {
      return NextResponse.json({ error: 'مسار الملف غير صالح' }, { status: 400 });
    }
    const item = await prisma.freeMedia.create({
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
    console.error('[admin free-media POST]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
