export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { Prisma } from '@prisma/client';
import { parseMediaItem, parseWaveform } from '@/lib/free-media-input';
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
    // In the background: the admin is waiting on the SAVE, not on storage housekeeping.
    // Awaiting these made every save that replaced a file as slow as an R2 round trip each.
    const stale = [
      existing.url !== parsed.data.url ? existing.url : null,
      existing.coverUrl && existing.coverUrl !== parsed.data.coverUrl ? existing.coverUrl : null,
      existing.previewUrl && existing.previewUrl !== parsed.data.previewUrl ? existing.previewUrl : null,
    ].filter((u): u is string => !!u);
    void Promise.all(stale.map(u => removeStoredMedia(u))).catch(() => {});

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
    void Promise.all([item.url, item.coverUrl, item.previewUrl].map(u => removeStoredMedia(u))).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin free-media DELETE]', err);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * A partial update: publish/unpublish, or the measurements the admin's browser takes from
 * the file (waveform, duration). Sending the whole form for a one-field change is what made
 * «نشر/إخفاء» as slow as a full save.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const data: Prisma.FreeMediaUpdateInput = {};
  if (typeof body.isPublished === 'boolean') data.isPublished = body.isPublished;
  if (body.waveform !== undefined) data.waveform = parseWaveform(body.waveform) ?? Prisma.DbNull;
  const dur = Number(body.durationSec);
  if (Number.isFinite(dur) && dur > 0) data.durationSec = Math.round(dur);
  if (!Object.keys(data).length) return NextResponse.json({ error: 'لا شيء للتحديث' }, { status: 400 });
  try {
    const item = await prisma.freeMedia.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  }
}
