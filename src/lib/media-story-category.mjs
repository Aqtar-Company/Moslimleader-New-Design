/**
 * Which طريق category a media-library item's post belongs in. Plain JavaScript so that
 * `ops/backfill-media-post-category.mjs` imports the SAME rule instead of copying it.
 *
 * A story is recognised by what the admin already wrote — the item's library category
 * («قصص»، «قصص صوتية»، «القصة»…, or an English name with "stor") or a title that says
 * «قصة». Nothing else is guessed: an audio item is not a story just for being audio
 * (a nasheed is audio too). Returns the canonical key from TAREEQ_CATEGORIES, or null.
 *
 * @param {{ title?: string | null, category?: { name?: string | null, nameEn?: string | null } | null }} item
 * @returns {'story' | null}
 */
export function mediaPostCategory(item) {
  const name = item?.category?.name ?? '';
  const nameEn = item?.category?.nameEn ?? '';
  const title = item?.title ?? '';
  if (/قص(ة|ص|صة)/.test(name) || /stor(y|ies)/i.test(nameEn) || /(^|\s)(ال)?قصة(\s|$|:|-)/.test(title)) return 'story';
  return null;
}
