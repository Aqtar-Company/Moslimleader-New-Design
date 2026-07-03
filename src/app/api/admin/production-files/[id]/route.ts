export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { deleteFromDrive } from '@/lib/google-drive';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const file = await prisma.productionFile.findUnique({ where: { id: params.id } });
  if (!file) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });

  await prisma.$transaction(async tx => {
    await tx.productionFile.delete({ where: { id: params.id } });
    if (file.isLatest) {
      const prev = await tx.productionFile.findFirst({
        where: { groupId: file.groupId, id: { not: params.id } },
        orderBy: { version: 'desc' },
      });
      if (prev) {
        await tx.productionFile.update({ where: { id: prev.id }, data: { isLatest: true } });
      }
    }
  });

  // Best-effort Drive delete after DB succeeds
  try {
    await deleteFromDrive(file.driveFileId);
  } catch (err) {
    console.error('[production-files/delete] Drive delete failed:', err);
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const allowed = ['title', 'notes', 'status', 'fileType', 'productId'] as const;
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) data[k] = body[k];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'لا يوجد بيانات للتحديث' }, { status: 400 });
  }

  const updated = await prisma.productionFile.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ ok: true, file: updated });
}
