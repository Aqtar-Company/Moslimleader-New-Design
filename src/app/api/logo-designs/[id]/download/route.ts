export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { downloadName, verifyDownloadToken } from '@/lib/logo-designs';

/**
 * GET /api/logo-designs/<id>/download — the print file of a published design, as an
 * attachment, counted. Needs an account (the owner's rule) — or a signed link
 * (`?t=`, see signDownloadToken) that a signed-in member sent to a print shop.
 *
 * Served through this site rather than linked on R2: a plain cross-origin link OPENS an
 * image or a PDF instead of saving it, and «مشاركة على واتساب» needs the file from the same
 * origin to hand it to the phone's share sheet (`?share=1` — counted the same way).
 */
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf' };

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const user = await getAuthUser().catch(() => null);
  if (!user && !verifyDownloadToken(id, req.nextUrl.searchParams.get('t'))) {
    // A person who opened the link in a browser is sent to sign in and back to the page.
    if ((req.headers.get('accept') ?? '').includes('text/html')) {
      return NextResponse.redirect(new URL('/login?redirect=%2Flogo', req.nextUrl.origin), 302);
    }
    return NextResponse.json({ error: 'سجّل الدخول للتحميل', needsLogin: true }, { status: 401 });
  }
  const d = await prisma.logoDesign.findFirst({ where: { id, isPublished: true }, select: { id: true, title: true, fileUrl: true, fileType: true } });
  if (!d) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const upstream = await fetch(d.fileUrl, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return NextResponse.redirect(d.fileUrl, 302);

  void prisma.logoDesign.update({ where: { id }, data: { downloads: { increment: 1 } } }).catch(() => {});
  const name = downloadName(d.title, d.id, d.fileType);
  const len = upstream.headers.get('content-length');
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': TYPES[d.fileType] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
      ...(len ? { 'Content-Length': len } : {}),
      'Cache-Control': 'no-store',
      // An SVG opened from this origin must never run anything.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
