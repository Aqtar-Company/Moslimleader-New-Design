/**
 * The media library's vocabulary — safe to import from client components (no Prisma, no
 * fs). The server half is `free-media.ts`.
 */

/** What a category belongs to. One category list per kind. */
export const MEDIA_KINDS = ['video', 'audio', 'image', 'pdf'] as const;
export type MediaKind = typeof MEDIA_KINDS[number];

/** Item `type` as stored → its kind. `mp3` is any audio; the name predates the others. */
export const TYPE_TO_KIND: Record<string, MediaKind> = { video: 'video', mp3: 'audio', image: 'image', pdf: 'pdf' };
export const KIND_TO_TYPE: Record<MediaKind, string> = { video: 'video', audio: 'mp3', image: 'image', pdf: 'pdf' };

/** Each kind's icon is the `<Icon>` of the same name (video / audio / image / pdf). */
export const KIND_LABEL: Record<MediaKind, { ar: string; en: string; one: string }> = {
  video: { ar: 'فيديوهات', en: 'Videos', one: 'فيديو' },
  audio: { ar: 'صوتيات', en: 'Audio', one: 'صوتي' },
  image: { ar: 'رسومات', en: 'Drawings', one: 'رسمة' },
  pdf:   { ar: 'ملفات PDF', en: 'PDFs', one: 'PDF' },
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

/** The item's public page. */
export const mediaPath = (id: number) => `/media/${id}`;
