/**
 * The score behind the «الأنفع» feed.
 *
 * That sort was `savedCount desc, likeCount desc` inside a 30-day window: popularity only,
 * with no sense of time. So within the window the oldest popular post stayed on top for a
 * month and a good post published this morning could not reach anyone — which is the same
 * complaint as a purely chronological feed, just stuck in the other direction.
 *
 * The shape is the one Hacker News and Reddit settled on, and for the same reasons:
 *
 *   score = log10(max(engagement, 1)) + ageTerm
 *
 * `log10` because the difference between 1 and 10 reactions says far more about a post
 * than the difference between 100 and 110 — without it a single very popular post
 * dominates the feed for as long as the window lasts. The age term is linear in time, so
 * every post's score rises steadily with its publication date: a newer post needs
 * proportionally less engagement to pass an older one, and nothing is frozen at the top.
 *
 * Weights: a save is worth more than a reaction because it costs more to give — saving
 * says "I will come back to this", which is exactly what «الأنفع» is asking about. A share
 * is worth most: it puts the author's name somewhere else.
 *
 * What this deliberately does NOT include is who the reader follows. That cannot live in a
 * column shared by every reader, and Tareeq already has a separate «من أتابع» feed for it.
 */

/** One point of score per this many seconds of age. 45,000s ≈ 12.5 hours. */
const AGE_DIVISOR = 45_000;

export type RankInputs = {
  savedCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  /** Publication time — `publishedAt` when set, otherwise `createdAt`. */
  at: Date;
};

export function computeHotScore(p: RankInputs): number {
  const engagement =
    (p.savedCount ?? 0) * 4 +
    (p.shareCount ?? 0) * 5 +
    (p.commentCount ?? 0) * 2 +
    (p.likeCount ?? 0);

  // max(engagement, 1) keeps log10 defined and makes a brand-new post with nothing yet
  // score purely on its age, which is what puts it in front of anyone at all.
  const quality = Math.log10(Math.max(engagement, 1));
  const age = p.at.getTime() / 1000 / AGE_DIVISOR;

  // Rounded: the float is written to MySQL and compared across rows, and trailing noise in
  // the 12th decimal place makes stored values differ for no reason.
  return Math.round((quality + age) * 1e6) / 1e6;
}
