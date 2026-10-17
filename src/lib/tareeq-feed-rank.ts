/**
 * The «لك» feed — ranked per reader, the way modern feeds rank, instead of by clock.
 *
 * ## What it replaced
 *
 * The default feed was `createdAt desc`: whoever posted last was on top. Two failures
 * follow from that and both were visible. A good mark from this morning was buried by
 * noon under whatever came after it, however much people engaged with it. And nothing
 * the reader did changed anything — following someone, muting someone, opening a post —
 * the feed was the same list for everybody, which is why unfollowing looked fake.
 *
 * ## The score, and why each part is there
 *
 *   score = quality × freshness × relationship × format × novelty
 *
 * - **quality** = 1 + log2(1 + engagement). Engagement weighs a save (4) and a share (5)
 *   above a comment (2) above a reaction (1), the same weights as «الأنفع» — the costlier
 *   the gesture, the more it says. The log keeps one viral post from owning the feed.
 * - **freshness** = 1 / (hours + 4)^1.2. Gravity decay, the Hacker News shape: a post loses
 *   ground steadily, so popularity buys time on top, not a permanent seat. The +4 keeps the
 *   first hours from dominating — with +2, any post minutes old with nothing on it beat a
 *   followed author's post from this morning.
 * - **relationship** — the part a shared column (`hotScore`) cannot hold, because it is
 *   different for every reader: ×2.5 for someone the reader follows, plus up to +1.5 for
 *   authors the reader has actually reacted to or commented on lately. Following is a
 *   promise; interaction is evidence.
 * - **format** — a small ×1.1 for a picture or a video, which hold attention in a feed.
 * - **novelty** — ×0.3 for a post the reader already opened or reacted to. It does not
 *   vanish (they may want it again), it just stops taking the top of the screen.
 *
 * The reader's OWN post is pinned near the top for its first hour — the confirmation that
 * it went out — and damped afterwards: nobody needs their own posts as news.
 *
 * Then **diversity**: no author twice within any three consecutive slots, so one prolific
 * account cannot fill a screen.
 *
 * ## Paging
 *
 * The ranking is computed once per snapshot over a window (the last 21 days by
 * publication, at most 400 posts), and the ranked id list is CACHED (src/lib/tareeq-feed.ts).
 * Pages slice that list by offset, so a hide, a mute or a reaction during scrolling cannot
 * reorder what is still to come — re-ranking per page did exactly that and skipped posts.
 * Past the window the feed continues chronologically, so nothing older is unreachable.
 */

export const FOR_YOU_WINDOW_DAYS = 21;
export const FOR_YOU_POOL = 400;

export type RankCandidate = {
  id: string;
  userId: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  likeCount: number;
  commentCount: number;
  savedCount: number;
  shareCount: number;
  imageUrl: string | null;
  videoUrl: string | null;
};

export type ReaderSignals = {
  viewerId: string | null;
  following: Set<string>;
  /** authorId → how many reactions/comments the reader gave that author lately. */
  affinity: Map<string, number>;
  /** Posts the reader opened or reacted to before the snapshot. */
  seen: Set<string>;
};

export function scoreForReader(p: RankCandidate, r: ReaderSignals, now: number): number {
  const engagement = p.savedCount * 4 + p.shareCount * 5 + p.commentCount * 2 + p.likeCount;
  const quality = 1 + Math.log2(1 + Math.max(0, engagement));

  const at = (p.publishedAt ?? p.createdAt).getTime();
  const hours = Math.max(0, (now - at) / 3_600_000);
  const freshness = 1 / Math.pow(hours + 4, 1.2);

  let relationship = 1;
  if (p.userId && r.following.has(p.userId)) relationship += 1.5;
  if (p.userId) relationship += Math.min(1.5, 0.3 * (r.affinity.get(p.userId) ?? 0));

  const format = p.imageUrl || p.videoUrl ? 1.1 : 1;
  const novelty = r.seen.has(p.id) ? 0.3 : 1;

  let score = quality * freshness * relationship * format * novelty;

  if (r.viewerId && p.userId === r.viewerId) {
    // Fresh own post: lift it over everything; afterwards, damp it.
    score = hours < 1 ? score * 50 : score * 0.5;
  }
  return score;
}

/** Re-order so the same author never appears twice within `gap` consecutive slots. */
export function diversify<T extends { userId: string | null }>(ranked: T[], gap = 3): T[] {
  const out: T[] = [];
  const pending = [...ranked];
  while (pending.length) {
    const recent = new Set(out.slice(-(gap - 1)).map(p => p.userId).filter(Boolean));
    const idx = pending.findIndex(p => !p.userId || !recent.has(p.userId));
    // Everyone left is a recent author: take the best anyway rather than drop posts.
    out.push(pending.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return out;
}

/**
 * Cursor forms:
 *  - `fy:<snapshotMs>:<offset>` — inside the ranked window.
 *  - `fyold:<boundaryMs>` / `fyold:<boundaryMs>:<postId>` — past it, chronological, older
 *    than the oldest ranked post. The boundary travels in the cursor so no post between
 *    the window and the chronological tail is skipped.
 */
export type ForYouCursor =
  | { kind: 'ranked'; snapshot: number; offset: number }
  | { kind: 'old'; boundary: number; afterId: string | null };

export function parseForYouCursor(c: string | undefined): ForYouCursor | null {
  if (!c) return null;
  // Times must be real instants: an absurd number becomes an Invalid Date, and Prisma
  // throws on it — a 500 from a hand-edited URL. Offsets are capped by the pool.
  const okTime = (n: number) => Number.isSafeInteger(n) && n > 1_500_000_000_000 && n < Date.now() + 86_400_000;
  let m = /^fy:(\d{1,16}):(\d{1,4})$/.exec(c);
  if (m) {
    const snapshot = Number(m[1]);
    const offset = Number(m[2]);
    return okTime(snapshot) && offset <= FOR_YOU_POOL ? { kind: 'ranked', snapshot, offset } : null;
  }
  m = /^fyold:(\d{1,16})(?::([A-Za-z0-9_-]{1,64}))?$/.exec(c);
  if (m) {
    const boundary = Number(m[1]);
    return okTime(boundary) ? { kind: 'old', boundary, afterId: m[2] ?? null } : null;
  }
  return null;
}
