export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { uploadToDrive, deleteFromDrive } from '@/lib/google-drive';
import { logActionSafe } from '@/lib/audit-log';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ALLOWED_CATEGORIES = ['print-ready', 'cover', 'proof', 'other'];
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/postscript',          // AI / EPS
  'image/png', 'image/jpeg', 'image/tiff', 'image/webp',
  'image/vnd.adobe.photoshop',        // PSD
  'application/zip', 'application/x-zip-compressed',
  'application/octet-stream',         // generic fallback for unknown binary
]);
// Extension allowlist — secondary gate that catches octet-stream abuse
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'ai', 'eps', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'webp', 'psd', 'zip',
]);

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

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext))
      return NextResponse.json({ error: 'امتداد الملف غير مدعوم' }, { status: 400 });

    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.has(mime))
      return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const driveResult = await uploadToDrive({ name: file.name, mimeType: mime, buffer });

    const effectiveGroupId = groupId ?? randomUUID();
    const isNewVersion = Boolean(groupId);

    // Atomic: flip isLatest on previous version + create new row in one transaction.
    // This prevents race conditions when two uploads arrive for the same groupId.
    let created;
    try {
      created = await prisma.$transaction(async tx => {
        let newVersion = 1;
        if (isNewVersion) {
          const prev = await tx.productionFile.findFirst({
            where: { groupId: groupId!, isLatest: true },
            select: { version: true },
          });
          if (prev) {
            newVersion = prev.version + 1;
            await tx.productionFile.updateMany({
              where: { groupId: groupId!, isLatest: true },
              data: { isLatest: false },
            });
          }
        }
        return tx.productionFile.create({
          data: {
            groupId: effectiveGroupId,
            version: newVersion,
            isLatest: true,
            fileName: file.name,
            mimeType: mime,
            fileSize: file.size,
            category,
            productId: productId || null,
            driveFileId: driveResult.id,
            driveWebViewLink: driveResult.webViewLink ?? null,
            notes,
            uploadedByUserId: guard.user.userId,
          },
        });
      });
    } catch (dbErr) {
      // DB failed after Drive upload succeeded → clean up the orphaned Drive file.
      try { await deleteFromDrive(driveResult.id); } catch {}
      throw dbErr;
    }

    await logActionSafe({
      actor: guard.user,
      action: isNewVersion ? 'production-file.version-replace' : 'production-file.upload',
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
