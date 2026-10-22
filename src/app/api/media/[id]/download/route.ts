export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { isAllowedMediaRef } from '@/lib/free-media';

/**
 * Download a media item — for signed-in members only.
 *
 * Watching and listening are open to everyone; saving the file asks for a free account,
 * which is how the library turns a visitor into a member. Honest limit: what a browser
 * can PLAY it can also save by other means — this gate is a doorway, not a vault.
 *
 * The file is streamed THROUGH this route with `Content-Disposition: attachment` and a
 * readable name. A plain link to R2 would open the video in a tab instead of saving it:
 * browsers ignore `download` on a cross-origin link.
 */
const MIME: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', pdf: 'application/pdf',
};

/** `bytes=a-b` → [start, end] within `size`, or null for anything we do not serve. */
function parseRange(h: string | null, size: number): [number, number] | null {
  const m = h ? /^bytes=(\d*)-(\d*)$/.exec(h.trim()) : null;
  if (!m || (!m[1] && !m[2])) return null;
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  start = Math.max(0, start); end = Math.min(size - 1, end);
  return start <= end ? [start, end] : null;
}

/**
 * `?inline=1` (staff only) serves the file to be PLAYED rather than saved, and honours
 * `Range` — that is how the admin page reads one frame out of a video to make its
 * thumbnail: the <video> element asks for the few ranges it needs instead of the whole file,
 * and the request is same-origin, so the frame can be drawn into a canvas without CORS.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'سجّل الدخول للتحميل', needsLogin: true }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const staff = user.role === 'admin' || user.role === 'staff';
  const inline = staff && req.nextUrl.searchParams.get('inline') === '1';
  const item = await prisma.freeMedia.findFirst({ where: { id, ...(staff ? {} : { isPublished: true }) }, select: { title: true, url: true } });
  if (!item || !isAllowedMediaRef(item.url)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const ext = (item.url.split('?')[0].split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = `${item.title.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim()} - Moslim Leader.${ext}`;
  const headers = new Headers({
    // RFC 5987: an Arabic file name needs the UTF-8 form; the ASCII one is the fallback.
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="moslimleader-${id}.${ext}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'private, no-store',
    'Accept-Ranges': 'bytes',
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
  });
  const rangeHeader = req.headers.get('range');

  let body: ReadableStream | null = null;
  let status = 200;
  if (item.url.startsWith('/free-media/')) {
    const file = path.join(process.cwd(), 'public', item.url);
    const st = await stat(file).catch(() => null);
    if (!st) return NextResponse.json({ error: 'الملف غير موجود على الخادم' }, { status: 404 });
    const r = parseRange(rangeHeader, st.size);
    if (r) {
      status = 206;
      headers.set('Content-Range', `bytes ${r[0]}-${r[1]}/${st.size}`);
      headers.set('Content-Length', String(r[1] - r[0] + 1));
      body = Readable.toWeb(createReadStream(file, { start: r[0], end: r[1] })) as unknown as ReadableStream;
    } else {
      headers.set('Content-Length', String(st.size));
      body = Readable.toWeb(createReadStream(file)) as unknown as ReadableStream;
    }
  } else {
    // R2 understands Range itself: pass it on and relay its answer.
    const upstream = await fetch(item.url, rangeHeader ? { headers: { Range: rangeHeader } } : undefined).catch(() => null);
    if (!upstream || !(upstream.ok || upstream.status === 206) || !upstream.body) return NextResponse.json({ error: 'تعذّر جلب الملف' }, { status: 502 });
    status = upstream.status === 206 ? 206 : 200;
    for (const k of ['content-length', 'content-range']) { const v = upstream.headers.get(k); if (v) headers.set(k, v); }
    if (!MIME[ext]) headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    body = upstream.body;
  }

  // The admin page reads files through here to measure them; that is not a download.
  if (!staff && status === 200) {
    void prisma.freeMedia.update({ where: { id }, data: { downloadCount: { increment: 1 } } }).catch(() => {});
  }
  return new Response(body, { status, headers });
}
