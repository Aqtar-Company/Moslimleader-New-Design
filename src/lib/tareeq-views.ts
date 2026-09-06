import { prisma } from '@/lib/prisma';

/**
 * Records a post view, once.
 *
 * Views used to be counted in three separate places with no agreement between them:
 * the SSR post page bumped `viewCount` on EVERY render (so a refresh, a back-navigation,
 * or the author opening their own post all counted) without ever creating a
 * `TareeqPostView` row, while the API route created the row. The result was an inflated
 * number sitting next to a viewer list that couldn't account for it.
 *
 * Rules:
 *  - the author's own views never count
 *  - a signed-in viewer counts at most once per post per day
 *  - anonymous views are counted but not attributed (no row to dedupe against)
 *  - the row and the counter always move together
 *
 * Safe to call fire-and-forget; it never throws.
 */
export async function recordPostView(
  postId: string,
  viewerId: string | null,
  authorId: string | null,
): Promise<void> {
  try {
    // Never count the author reading their own post.
    if (viewerId && authorId && viewerId === authorId) return;

    if (viewerId) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const seenToday = await prisma.tareeqPostView.findFirst({
        where: { postId, userId: viewerId, createdAt: { gte: since } },
        select: { id: true },
      });
      if (seenToday) return;
    }

    await prisma.$transaction([
      prisma.tareeqPostView.create({ data: { postId, userId: viewerId } }),
      prisma.tareeqPost.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } }),
    ]);
  } catch {
    /* view tracking is best-effort — never let it break rendering */
  }
}
