export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadName } from '@/lib/logo-designs';

/**
 * GET /api/logo-designs/<id>/download — the print file of a published design, as an
 * attachment, counted. Open to everyone: the page exists so people can print the logo.
 *
 * Served through this site rather than linked on R2: a plain cross-origin link OPENS an
 * image or a PDF instead of saving it, and «مشاركة على واتساب» needs the file from the same
 * origin to hand it to the phone's share sheet (`?share=1` — counted the same way).
 */
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf' };

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
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
