export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { streamFromDrive } from '@/lib/google-drive';
import { Readable } from 'stream';

// GET /api/admin/production-files/[id]/download — stream file from Drive
// Streams the response to avoid buffering large files in Node.js heap.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePerm('production-files.read');
  if ('response' in guard) return guard.response;

  const { id } = await params;
  const file = await prisma.productionFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });

  try {
    const driveStream = await streamFromDrive(file.driveFileId);
    // Convert Node.js stream to Web ReadableStream for NextResponse
    const webStream = Readable.toWeb(driveStream as Parameters<typeof Readable.toWeb>[0]) as ReadableStream;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      },
    });
  } catch (err) {
    console.error('[production-files download]', err);
    return NextResponse.json({ error: 'فشل تحميل الملف من Google Drive' }, { status: 500 });
  }
}
