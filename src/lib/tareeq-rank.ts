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

/**
 * One point of score per this many seconds of age — 3 days.
 *
 * It was 45,000s (12.5 hours), the Reddit constant. With log10 engagement that made one
 * point of score — TEN times the engagement — worth only half a day, so on «الأنفع» a post
 * published half an hour ago with nothing on it outranked yesterday's post with 30
 * reactions, 8 comments and 4 saves. «الأنفع» was «جديد» by another name. At 3 days, ten
 * times the engagement buys three days: a well-received post holds the top for days and
 * then gives way, and a new post still rises as soon as people engage with it.
 *
 * Changing this changes the SCALE of every stored score, so after a change every recent
 * post must be rescored once (GET /api/cron/tareeq-cleanup does it) — otherwise old and
 * new scores are compared on two different scales.
 */
const AGE_DIVISOR = 3 * 86_400;

/** Larger than any span of the age term inside the 30-day window (≈10 points). */
const NO_ENGAGEMENT_PENALTY = 1000;

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

  // A post nobody has engaged with yet is not «الأنفع» — nothing says it was useful. It
  // used to score on its age alone, which put every brand-new empty post above last week's
  // well-received ones (seen on the live feed: a bare link with no reaction at #3). Such a
  // post now sorts BELOW every post with at least one reaction, newest first among
  // themselves; its first reaction lifts it into the ranking. A new post reaches people
  // through «جديد» and «لك», which is what those tabs are for.
  const quality = engagement > 0 ? Math.log10(engagement) : -NO_ENGAGEMENT_PENALTY;
  const age = p.at.getTime() / 1000 / AGE_DIVISOR;

  // Rounded: the float is written to MySQL and compared across rows, and trailing noise in
  // the 12th decimal place makes stored values differ for no reason.
  return Math.round((quality + age) * 1e6) / 1e6;
}
