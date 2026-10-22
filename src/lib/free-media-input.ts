/**
 * Validation of an item as the admin form sends it — one copy for create and update.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAllowedMediaRef, kindOfType } from '@/lib/free-media';

export const VALID_MEDIA_TYPES = ['mp3', 'video', 'image', 'pdf'] as const;

export type MediaItemInput = {
  title: string;
  titleEn: string | null;
  type: string;
  url: string;
  coverUrl: string | null;
  description: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  isPublished: boolean;
  categoryId: number | null;
  durationSec: number | null;
  previewUrl: string | null;
  waveform?: number[] | typeof Prisma.DbNull;
};

/** ~120 integers 0–100, or null. Anything else is dropped rather than stored. */
export function parseWaveform(v: unknown): number[] | null | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length < 8 || v.length > 400) return null;
  const out = v.map(n => Math.max(0, Math.min(100, Math.round(Number(n) || 0))));
  return out;
}

export async function parseMediaItem(body: Record<string, unknown>): Promise<{ data: MediaItemInput } | { error: string }> {
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const title = str(body.title, 190);
  const type = str(body.type, 10);
  const url = str(body.url, 190);
  if (!title || !type || !url) return { error: 'العنوان والنوع والملف مطلوبون' };
  if (!(VALID_MEDIA_TYPES as readonly string[]).includes(type)) return { error: 'نوع الوسيط غير صالح' };
  const coverUrl = str(body.coverUrl, 190) || null;
  const previewUrl = str(body.previewUrl, 190) || null;
  if (!isAllowedMediaRef(url) || !isAllowedMediaRef(coverUrl) || !isAllowedMediaRef(previewUrl)) return { error: 'مسار الملف غير صالح' };

  // A category must exist AND belong to this item's kind: an audio item filed under a
  // video shelf would appear under a chip that lists nothing else like it.
  let categoryId: number | null = null;
  if (body.categoryId !== null && body.categoryId !== undefined && body.categoryId !== '') {
    const id = Number(body.categoryId);
    if (!Number.isInteger(id)) return { error: 'التصنيف غير صالح' };
    const cat = await prisma.freeMediaCategory.findUnique({ where: { id }, select: { kind: true } });
    if (!cat || cat.kind !== kindOfType(type)) return { error: 'التصنيف لا يخص هذا النوع' };
    categoryId = id;
  }

  const dur = Number(body.durationSec);
  return {
    data: {
      title,
      titleEn: str(body.titleEn, 190) || null,
      type,
      url,
      coverUrl,
      description: str(body.description, 5000) || null,
      descriptionEn: str(body.descriptionEn, 5000) || null,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
      isPublished: body.isPublished === true,
      categoryId,
      durationSec: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null,
      previewUrl,
      // Absent = leave it; null/garbage = clear it (a DB NULL, not the JSON value `null`).
      ...(body.waveform !== undefined ? { waveform: parseWaveform(body.waveform) ?? Prisma.DbNull } : {}),
    },
  };
}
