export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { downloadFromDrive } from '@/lib/google-drive';

// GET /api/admin/production-files/[id]/download — stream file from Drive
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
    const buffer = await downloadFromDrive(file.driveFileId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    console.error('[production-files download]', err);
    return NextResponse.json({ error: 'فشل تحميل الملف من Google Drive' }, { status: 500 });
  }
}
