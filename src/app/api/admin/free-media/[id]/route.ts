export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { parseMediaItem } from '@/lib/free-media-input';
import { removeStoredMedia } from '@/lib/free-media';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 });
    const existing = await prisma.freeMedia.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    const parsed = await parseMediaItem(await req.json().catch(() => ({})));
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const item = await prisma.freeMedia.update({ where: { id }, data: parsed.data });

    // Only AFTER the row points elsewhere: deleting first and then failing the update would
    // leave a published item pointing at nothing.
    if (existing.url !== parsed.data.url) await removeStoredMedia(existing.url);
    if (existing.coverUrl && existing.coverUrl !== parsed.data.coverUrl) await removeStoredMedia(existing.coverUrl);

    return NextResponse.json({ item });
  } catch (err) {
    console.error('[admin free-media PUT]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 });
    const item = await prisma.freeMedia.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    await prisma.freeMedia.delete({ where: { id } });
    await removeStoredMedia(item.url);
    await removeStoredMedia(item.coverUrl);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin free-media DELETE]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
