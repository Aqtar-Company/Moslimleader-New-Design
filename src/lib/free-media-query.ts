/**
 * Reads for the public media pages. Server-only (Prisma).
 */
import { prisma } from '@/lib/prisma';
import { PUBLIC_MEDIA_SELECT } from '@/lib/free-media';
import { TYPE_TO_KIND, type MediaKind } from '@/lib/free-media-shared';

export type PublicMediaItem = {
  id: number; title: string; titleEn: string | null; type: string; kind: MediaKind;
  url: string; coverUrl: string | null; description: string | null; descriptionEn: string | null;
  durationSec: number | null; viewCount: number; createdAt: string;
  categoryId: number | null; category: { id: number; name: string; nameEn: string | null } | null;
};
export type PublicMediaCategory = { id: number; kind: MediaKind; name: string; nameEn: string | null };

type Row = Awaited<ReturnType<typeof fetchRows>>[number];
function fetchRows(where: object = {}) {
  return prisma.freeMedia.findMany({
    where: { isPublished: true, ...where },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: PUBLIC_MEDIA_SELECT,
  });
}

function toPublic(r: Row): PublicMediaItem | null {
  const kind = TYPE_TO_KIND[r.type];
  if (!kind) return null;
  return { ...r, kind, createdAt: r.createdAt.toISOString() };
}

/** Every published item, and the categories that actually hold one (empty shelves hidden). */
export async function loadMediaLibrary(): Promise<{ items: PublicMediaItem[]; categories: PublicMediaCategory[] }> {
  const [rows, cats] = await Promise.all([
    fetchRows(),
    prisma.freeMediaCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
  ]);
  const items = rows.map(toPublic).filter((i): i is PublicMediaItem => !!i);
  const used = new Set(items.map(i => i.categoryId).filter(Boolean));
  const categories = cats
    .filter(c => used.has(c.id))
    .map(c => ({ id: c.id, kind: c.kind as MediaKind, name: c.name, nameEn: c.nameEn }));
  return { items, categories };
}

/**
 * One item and what plays after it: the rest of its category in order — starting AFTER it,
 * so a bedtime-stories shelf plays through like a playlist — then the rest of its kind.
 */
export async function loadMediaItem(id: number): Promise<{ item: PublicMediaItem; upNext: PublicMediaItem[] } | null> {
  const row = await prisma.freeMedia.findFirst({ where: { id, isPublished: true }, select: PUBLIC_MEDIA_SELECT });
  const item = row ? toPublic(row) : null;
  if (!item) return null;
  const sameKind = (await fetchRows({ type: item.type })).map(toPublic).filter((i): i is PublicMediaItem => !!i);
  const shelf = item.categoryId ? sameKind.filter(i => i.categoryId === item.categoryId) : [];
  const at = shelf.findIndex(i => i.id === item.id);
  const afterInShelf = at >= 0 ? [...shelf.slice(at + 1), ...shelf.slice(0, at)] : [];
  const rest = sameKind.filter(i => i.id !== item.id && !afterInShelf.some(s => s.id === i.id));
  return { item, upNext: [...afterInShelf, ...rest].slice(0, 30) };
}

/** Absolute URL for a stored file — legacy disk paths are relative. */
export function absoluteMediaUrl(u: string | null, site: string): string | null {
  if (!u) return null;
  return /^https?:\/\//.test(u) ? u : `${site.replace(/\/+$/, '')}${u}`;
}

/** The newest published items, for the strip on the home page. */
export async function loadLatestMedia(limit = 8): Promise<PublicMediaItem[]> {
  const rows = await prisma.freeMedia.findMany({
    where: { isPublished: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: PUBLIC_MEDIA_SELECT,
  });
  return rows.map(toPublic).filter((i): i is PublicMediaItem => !!i);
}
