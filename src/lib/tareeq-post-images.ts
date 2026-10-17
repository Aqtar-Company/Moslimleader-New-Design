/**
 * Every image of a post, in order.
 *
 * A post stores its pictures twice: `imageUrls` (the whole list, up to nine) and
 * `imageUrl` (the first, kept for the card, previews and older rows). The post page and the
 * sheet read only `imageUrl`, so a post of two images showed one and the second was
 * unreachable from anywhere but the feed grid. Read the list; fall back to the single field.
 */
export function postImages(post: { imageUrl?: string | null; imageUrls?: unknown }): string[] {
  const list = Array.isArray(post.imageUrls)
    ? (post.imageUrls as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 0)
    : [];
  if (list.length) return list;
  return post.imageUrl ? [post.imageUrl] : [];
}
