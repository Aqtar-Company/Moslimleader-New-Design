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
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'سجّل الدخول للتحميل', needsLogin: true }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const staff = user.role === 'admin' || user.role === 'staff';
  const item = await prisma.freeMedia.findFirst({ where: { id, ...(staff ? {} : { isPublished: true }) }, select: { title: true, url: true } });
  if (!item || !isAllowedMediaRef(item.url)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const ext = (item.url.split('?')[0].split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = `${item.title.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim()} - Moslim Leader.${ext}`;
  const headers = new Headers({
    // RFC 5987: an Arabic file name needs the UTF-8 form; the ASCII one is the fallback.
    'Content-Disposition': `attachment; filename="moslimleader-${id}.${ext}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'private, no-store',
  });

  let body: ReadableStream | null = null;
  if (item.url.startsWith('/free-media/')) {
    const file = path.join(process.cwd(), 'public', item.url);
    const st = await stat(file).catch(() => null);
    if (!st) return NextResponse.json({ error: 'الملف غير موجود على الخادم' }, { status: 404 });
    headers.set('Content-Length', String(st.size));
    headers.set('Content-Type', 'application/octet-stream');
    body = Readable.toWeb(createReadStream(file)) as unknown as ReadableStream;
  } else {
    const upstream = await fetch(item.url).catch(() => null);
    if (!upstream || !upstream.ok || !upstream.body) return NextResponse.json({ error: 'تعذّر جلب الملف' }, { status: 502 });
    const len = upstream.headers.get('content-length');
    if (len) headers.set('Content-Length', len);
    headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    body = upstream.body;
  }

  // The admin page reads files through here to measure them; that is not a download.
  if (user.role !== 'admin' && user.role !== 'staff') {
    void prisma.freeMedia.update({ where: { id }, data: { downloadCount: { increment: 1 } } }).catch(() => {});
  }
  return new Response(body, { status: 200, headers });
}
