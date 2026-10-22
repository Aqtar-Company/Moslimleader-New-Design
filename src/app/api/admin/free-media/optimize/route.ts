export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { stat } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { putToR2 } from '@/lib/r2';
import {
  R2_MEDIA_PREFIX, compressCover, drawingPreview, drawingThumb, readStoredMedia, removeStoredMedia,
} from '@/lib/free-media';

/**
 * «ضغط الملفات الحالية» — bring items uploaded BEFORE compression existed down to size.
 *
 * Works in small batches (`afterId` cursor, 8 items a call) so no single request holds a
 * connection for minutes; the admin page calls it in a loop and shows the progress.
 *
 * Per item:
 *  - a cover heavier than 250 KB is replaced by its compressed copy;
 *  - a drawing with no display copy gets one, and a grid thumbnail if it has no cover.
 * The old file is deleted only after the row points at the new one.
 * Audio and video are not touched here: re-encoding them on this server would hold the
 * CPU the shop runs on (see CLAUDE.md). Videos are compressed in the browser on upload.
 */
const BATCH = 8;
const HEAVY_COVER = 250 * 1024;

async function sizeOf(url: string): Promise<number | null> {
  if (url.startsWith('/free-media/')) {
    const st = await stat(path.join(process.cwd(), 'public', url)).catch(() => null);
    return st ? st.size : null;
  }
  const res = await fetch(url, { method: 'HEAD' }).catch(() => null);
  const len = res?.ok ? Number(res.headers.get('content-length')) : NaN;
  return Number.isFinite(len) ? len : null;
}

export async function POST(req: NextRequest) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const afterId = Number.isInteger(body.afterId) ? body.afterId : 0;
  const items = await prisma.freeMedia.findMany({
    where: { id: { gt: afterId } },
    orderBy: { id: 'asc' },
    take: BATCH,
    select: { id: true, type: true, url: true, coverUrl: true, previewUrl: true },
  });
  const total = await prisma.freeMedia.count();
  const doneSoFar = await prisma.freeMedia.count({ where: { id: { lte: items.length ? items[items.length - 1].id : afterId } } });

  let changed = 0;
  let savedBytes = 0;
  const failures: number[] = [];

  for (const it of items) {
    try {
      const data: { coverUrl?: string; previewUrl?: string } = {};
      const toRemove: string[] = [];

      if (it.coverUrl) {
        const size = await sizeOf(it.coverUrl);
        if (size !== null && size > HEAVY_COVER) {
          const buf = await readStoredMedia(it.coverUrl);
          if (buf) {
            const small = await compressCover(buf);
            if (small.length < buf.length) {
              data.coverUrl = await putToR2(`${R2_MEDIA_PREFIX}covers/${randomUUID()}.jpg`, small, 'image/jpeg');
              toRemove.push(it.coverUrl);
              savedBytes += buf.length - small.length;
            }
          }
        }
      }

      if (it.type === 'image' && !it.previewUrl) {
        const buf = await readStoredMedia(it.url);
        if (buf) {
          const id = randomUUID();
          const preview = await drawingPreview(buf);
          data.previewUrl = await putToR2(`${R2_MEDIA_PREFIX}previews/${id}.webp`, preview, 'image/webp');
          savedBytes += Math.max(0, buf.length - preview.length);
          if (!it.coverUrl && !data.coverUrl) {
            const thumb = await drawingThumb(buf);
            data.coverUrl = await putToR2(`${R2_MEDIA_PREFIX}covers/${id}.jpg`, thumb, 'image/jpeg');
          }
        }
      }

      if (Object.keys(data).length) {
        await prisma.freeMedia.update({ where: { id: it.id }, data });
        changed++;
        for (const u of toRemove) await removeStoredMedia(u);
      }
    } catch (e) {
      console.error('[free-media optimize]', it.id, e);
      failures.push(it.id);
    }
  }

  return NextResponse.json({
    nextAfterId: items.length === BATCH ? items[items.length - 1].id : null,
    processed: doneSoFar,
    total,
    changed,
    savedBytes,
    failures,
  });
}
