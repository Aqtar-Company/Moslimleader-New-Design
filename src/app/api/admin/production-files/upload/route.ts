export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { uploadToDrive } from '@/lib/google-drive';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

const ALLOWED: Record<string, string> = {
  pdf: 'application/pdf',
  ai: 'application/postscript',
  eps: 'application/postscript',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  webp: 'image/webp',
  psd: 'image/vnd.adobe.photoshop',
  zip: 'application/zip',
};

export async function POST(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string | null)?.trim() || '';
  const fileType = (formData.get('fileType') as string | null)?.trim() || 'design';
  const productId = (formData.get('productId') as string | null)?.trim() || null;
  const groupId = (formData.get('groupId') as string | null)?.trim() || randomUUID();
  const notes = (formData.get('notes') as string | null)?.trim() || null;

  if (!file) return NextResponse.json({ error: 'لم يتم إرفاق ملف' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED[ext]) {
    return NextResponse.json({ error: 'امتداد الملف غير مدعوم' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'حجم الملف يتجاوز 500 ميجابايت' }, { status: 400 });
  }

  // Determine next version for this group
  const existing = await prisma.productionFile.findMany({
    where: { groupId },
    orderBy: { version: 'desc' },
    take: 1,
  });
  const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;
  const isNewGroup = existing.length === 0;

  const mimeType = ALLOWED[ext];
  const buffer = Buffer.from(await file.arrayBuffer());
  const driveName = `${groupId}_v${nextVersion}_${file.name}`;

  let driveFileId: string;
  try {
    const res = await uploadToDrive({ buffer, name: driveName, mimeType });
    driveFileId = res.id;
  } catch (err) {
    console.error('[production-files/upload] Drive error:', err);
    return NextResponse.json({ error: 'فشل الرفع على Drive' }, { status: 500 });
  }

  // Atomically: mark old latest → false, insert new record
  const record = await prisma.$transaction(async tx => {
    if (!isNewGroup) {
      await tx.productionFile.updateMany({
        where: { groupId, isLatest: true },
        data: { isLatest: false },
      });
    }
    return tx.productionFile.create({
      data: {
        groupId,
        productId: productId || null,
        title,
        fileType,
        driveFileId,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        version: nextVersion,
        isLatest: true,
        notes,
        uploadedBy: user.userId,
      },
    });
  });

  return NextResponse.json({ ok: true, file: record });
}
