export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShareImage, isShareableSource } from '@/lib/share-image';

/**
 * GET /api/share-image?u=<R2 url> — the og:image of a shared link, from our own domain
 * (see src/lib/share-image.ts for why). Only R2 objects are accepted. On any failure it
 * redirects to the original, so a share never loses its picture because of this route.
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') ?? '';
  if (!isShareableSource(u)) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const img = await getShareImage(u);
  if (!img) return NextResponse.redirect(u, 302);
  return new NextResponse(new Uint8Array(img.buf), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(img.buf.length),
      // Every R2 key is unique, so the same URL never names a different picture.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
