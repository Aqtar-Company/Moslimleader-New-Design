/**
 * The media-library item a طريق post can carry — the select and its shape. Client-safe
 * (no Prisma import), so TareeqCard can use the type and the server queries the select.
 */
export const POST_MEDIA_SELECT = {
  id: true, title: true, titleEn: true, type: true, url: true, coverUrl: true, previewUrl: true,
  durationSec: true, isPublished: true, waveform: true,
  category: { select: { name: true, nameEn: true } },
} as const;

export interface PostMedia {
  id: number;
  title: string;
  titleEn: string | null;
  /** 'mp3' | 'video' | 'reel' | 'image' | 'pdf' */
  type: string;
  url: string;
  coverUrl: string | null;
  previewUrl: string | null;
  durationSec: number | null;
  /** An unpublished item is not drawn — the card falls back to the post's own words. */
  isPublished: boolean;
  /** Audio only: ~120 loudness peaks (0–100), drawn as the player's seek bar. JSON column. */
  waveform?: unknown;
  category?: { name: string; nameEn: string | null } | null;
}
