export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { uploadToDrive } from '@/lib/google-drive';
import { logActionSafe } from '@/lib/audit-log';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB
const ALLOWED_CATEGORIES = ['print-ready', 'cover', 'proof', 'other'];

// POST /api/admin/production-files/upload
// FormData: file (File), category (string), productId? (string), groupId? (string for new version), notes? (string)
export async function POST(req: NextRequest) {
  const guard = await requirePerm('production-files.write');
  if ('response' in guard) return guard.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string | null)?.trim() ?? '';
    const productId = (formData.get('productId') as string | null)?.trim() || null;
    const groupId = (formData.get('groupId') as string | null)?.trim() || null;
    const notes = (formData.get('notes') as string | null)?.trim() || null;

    if (!file) return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });
    if (!ALLOWED_CATEGORIES.includes(category))
      return NextResponse.json({ error: 'التصنيف غير صالح' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: 'حجم الملف يتجاوز 200 ميجابايت' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const driveResult = await uploadToDrive({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      buffer,
    });

    let newVersion = 1;
    const effectiveGroupId = groupId ?? randomUUID();

    if (groupId) {
      // Mark previous latest as not latest
      const prev = await prisma.productionFile.findFirst({
        where: { groupId, isLatest: true },
        select: { version: true },
      });
      if (prev) {
        newVersion = prev.version + 1;
        await prisma.productionFile.updateMany({
          where: { groupId, isLatest: true },
          data: { isLatest: false },
        });
      }
    }

    const created = await prisma.productionFile.create({
      data: {
        groupId: effectiveGroupId,
        version: newVersion,
        isLatest: true,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        category,
        productId: productId || null,
        driveFileId: driveResult.id,
        driveWebViewLink: driveResult.webViewLink,
        driveDownloadLink: driveResult.downloadLink,
        notes,
        uploadedByUserId: guard.user.userId,
      },
    });

    await logActionSafe({
      actor: guard.user,
      action: groupId ? 'production-file.version-replace' : 'production-file.upload',
      entity: 'ProductionFile',
      entityId: created.id,
      after: { fileName: created.fileName, version: created.version, driveFileId: driveResult.id },
    });

    return NextResponse.json({ file: created }, { status: 201 });
  } catch (err) {
    console.error('[production-files upload]', err);
    return NextResponse.json({ error: 'فشل رفع الملف' }, { status: 500 });
  }
}
