export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { deleteFromDrive } from '@/lib/google-drive';
import { logActionSafe } from '@/lib/audit-log';

// GET /api/admin/production-files/[id] — get a single file (any version)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePerm('production-files.read');
  if ('response' in guard) return guard.response;

  const { id } = await params;
  const file = await prisma.productionFile.findUnique({
    where: { id },
    include: { product: { select: { id: true, name: true, slug: true } } },
  });
  if (!file) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
  return NextResponse.json({ file });
}

// DELETE /api/admin/production-files/[id] — delete from Drive + DB
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePerm('production-files.write');
  if ('response' in guard) return guard.response;

  const { id } = await params;
  const file = await prisma.productionFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });

  // Atomic: delete row + promote previous version in one transaction
  await prisma.$transaction(async tx => {
    await tx.productionFile.delete({ where: { id } });
    if (file.isLatest) {
      const prev = await tx.productionFile.findFirst({
        where: { groupId: file.groupId, id: { not: id } },
        orderBy: { version: 'desc' },
      });
      if (prev) {
        await tx.productionFile.update({ where: { id: prev.id }, data: { isLatest: true } });
      }
    }
  });

  // Delete from Google Drive after DB succeeds (best-effort)
  try {
    await deleteFromDrive(file.driveFileId);
  } catch (driveErr) {
    console.error('[production-files delete drive]', driveErr);
  }

  await logActionSafe({
    actor: guard.user,
    action: 'production-file.delete',
    entity: 'ProductionFile',
    entityId: id,
    before: { fileName: file.fileName, version: file.version },
  });

  return NextResponse.json({ ok: true });
}
