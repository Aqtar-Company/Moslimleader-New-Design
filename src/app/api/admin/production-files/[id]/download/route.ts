export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { streamFromDrive } from '@/lib/google-drive';
import { Readable } from 'stream';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const file = await prisma.productionFile.findUnique({ where: { id: params.id } });
  if (!file) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });

  try {
    const driveStream = await streamFromDrive(file.driveFileId);
    const nodeStream = driveStream as unknown as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of nodeStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const inline = req.nextUrl.searchParams.get('inline') === '1';
    const disposition = inline
      ? `inline; filename="${encodeURIComponent(file.fileName)}"`
      : `attachment; filename="${encodeURIComponent(file.fileName)}"`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': disposition,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    console.error('[production-files/download] Drive stream error:', err);
    return NextResponse.json({ error: 'فشل تحميل الملف من Drive' }, { status: 500 });
  }
}
