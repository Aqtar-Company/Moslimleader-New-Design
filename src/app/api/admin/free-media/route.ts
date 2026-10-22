export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { parseMediaItem } from '@/lib/free-media-input';

// The permission the admin nav already used for this page. The routes checked
// `role === 'admin'` instead, so a staff member granted «الوسائط المجانية» saw the page
// and then got «غير مصرح» from every request on it.
export async function GET() {
  const guard = await requirePerm(['free-media.read', 'free-media.write', 'books.read']);
  if ('response' in guard) return guard.response;
  try {
    const [items, categories] = await Promise.all([
      prisma.freeMedia.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
      prisma.freeMediaCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: { _count: { select: { items: true } } },
      }),
    ]);
    return NextResponse.json({ items, categories });
  } catch (err) {
    console.error('[admin free-media GET]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  try {
    const parsed = await parseMediaItem(await req.json().catch(() => ({})));
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const item = await prisma.freeMedia.create({ data: parsed.data });
    return NextResponse.json({ item });
  } catch (err) {
    console.error('[admin free-media POST]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
