export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const items = await prisma.freeMedia.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, title: true, titleEn: true, type: true,
        url: true, coverUrl: true, description: true, descriptionEn: true,
      },
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[free-media GET]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
