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

    // Anonymous: bump the counter but write no row. The "who viewed" list filters
    // `userId: { not: null }`, so an anonymous row is pure ballast — and this path runs on
    // every SSR render, including bots, link-preview fetchers and RSC prefetches, which
    // would grow TareeqPostView by a row per pageview forever.
    if (!viewerId) {
      await prisma.tareeqPost.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } });
      return;
    }

    const seenToday = await prisma.tareeqPostView.findFirst({
      where: { postId, userId: viewerId, createdAt: { gte: startOfLocalDay() } },
      select: { id: true },
    });
    if (seenToday) return;

    await prisma.$transaction([
      prisma.tareeqPostView.create({ data: { postId, userId: viewerId } }),
      prisma.tareeqPost.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } }),
    ]);
  } catch {
    /* view tracking is best-effort — never let it break rendering */
  }
}

/**
 * Midnight in the audience's timezone, not the server's.
 *
 * `new Date().setHours(0,0,0,0)` uses the Node process TZ, which nothing in this repo
 * pins — on a UTC VPS the "day" would flip at 02:00/03:00 Cairo, so someone reading at
 * 00:30 and again at 03:30 local counts twice. The khatmati routes solve the same problem
 * by taking the client's `localDate`; view recording happens server-side with no client
 * involved, so the boundary is pinned explicitly instead.
 *
 * Caveat: the dedupe is a read-then-write and TareeqPostView has no unique key on
 * (postId, userId, day), so two truly concurrent first-views of the same post can both
 * insert. That costs one extra row and one extra count, not correctness of the viewer list.
 */
const DAY_TZ = 'Africa/Cairo';
function startOfLocalDay(): Date {
  const now = new Date();
  // e.g. "2026-09-07" in Cairo, whatever the server clock is set to.
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAY_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  // Offset (in minutes) between the server's UTC clock and Cairo at this instant.
  const asUtc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const asLocal = new Date(now.toLocaleString('en-US', { timeZone: DAY_TZ }));
  const offsetMs = asLocal.getTime() - asUtc.getTime();
  return new Date(new Date(`${localDate}T00:00:00.000Z`).getTime() - offsetMs);
}
