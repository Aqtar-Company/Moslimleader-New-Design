/**
 * The media library's vocabulary — safe to import from client components (no Prisma, no
 * fs). The server half is `free-media.ts`.
 */

/** What a category belongs to. One category list per kind. */
export const MEDIA_KINDS = ['reel', 'video', 'audio', 'image', 'pdf'] as const;
export type MediaKind = typeof MEDIA_KINDS[number];

/** Item `type` as stored → its kind. `mp3` is any audio; the name predates the others. */
export const TYPE_TO_KIND: Record<string, MediaKind> = { reel: 'reel', video: 'video', mp3: 'audio', image: 'image', pdf: 'pdf' };
export const KIND_TO_TYPE: Record<MediaKind, string> = { reel: 'reel', video: 'video', audio: 'mp3', image: 'image', pdf: 'pdf' };

/** Each kind's icon is the `<Icon>` of the same name (reel / video / audio / image / pdf). */
/** `short` is the tab label on a phone, where five tabs share one row. */
export const KIND_LABEL: Record<MediaKind, { ar: string; en: string; one: string; short: string }> = {
  reel:  { ar: 'ريلز', en: 'Reels', one: 'ريل', short: 'ريلز' },
  video: { ar: 'فيديوهات', en: 'Videos', one: 'فيديو', short: 'فيديو' },
  audio: { ar: 'صوتيات', en: 'Audio', one: 'صوتي', short: 'صوتيات' },
  image: { ar: 'رسومات', en: 'Drawings', one: 'رسمة', short: 'رسومات' },
  pdf:   { ar: 'ملفات PDF', en: 'PDFs', one: 'PDF', short: 'PDF' },
};

export function isMediaKind(v: unknown): v is MediaKind {
  return typeof v === 'string' && (MEDIA_KINDS as readonly string[]).includes(v);
}

/** `2:05`, `1:02:09`. */
export function formatDuration(sec: number | null | undefined): string | null {
  if (!sec || !Number.isFinite(sec) || sec <= 0) return null;
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

/**
 * A small copy of a library picture, for the places that show it small (see
 * src/app/api/media/thumb/route.ts). Anything that is not this library's own file is
 * returned unchanged.
 */
export function mediaThumbUrl(url: string | null | undefined, w: 160 | 320 | 640): string | null {
  if (!url) return null;
  const ours = url.startsWith('/free-media/') || /\/free-media\//.test(url);
  return ours ? `/api/media/thumb?w=${w}&u=${encodeURIComponent(url)}` : url;
}

/** The item's public page. */
export const mediaPath = (id: number, kind?: MediaKind) => (kind === 'reel' ? `/media/reels/${id}` : `/media/${id}`);

/** Reactions are طريق's own set, so the two places speak one language. */
export { TAREEQ_REACTIONS as MEDIA_REACTIONS } from '@/lib/tareeq-constants';
export const MEDIA_REACTION_TYPES = ['inspired', 'thanks', 'agree', 'yarabb', 'mashaallah'] as const;
