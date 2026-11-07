import { prisma } from '@/lib/prisma';
import { computeHotScore } from '@/lib/tareeq-rank';

/**
 * Re-write one post's «الأنفع» score from its CURRENT counters.
 *
 * `hotScore` used to be written only when a post was created and by the nightly
 * /api/cron/tareeq-cleanup pass. Its time term is the publication instant, so the gap
 * between two posts never changes as time passes: the ONLY thing that can move a post up
 * «الأنفع» is engagement — and that was ignored until the cron ran (if it ran at all).
 * Between runs «الأنفع» was simply «جديد» inside a 30-day window.
 *
 * So every route that changes likeCount / commentCount / savedCount / shareCount calls
 * `rescoreSoon(postId)` after its write. Two small queries, fire-and-forget: a failure
 * costs one post's freshness until the next change or the nightly pass, never the request.
 */
export async function rescorePost(postId: string): Promise<void> {
  const p = await prisma.tareeqPost.findUnique({
    where: { id: postId },
    select: { savedCount: true, likeCount: true, commentCount: true, shareCount: true, publishedAt: true, createdAt: true, isDraft: true },
  });
  if (!p || p.isDraft) return;
  const hotScore = computeHotScore({
    savedCount: p.savedCount, likeCount: p.likeCount, commentCount: p.commentCount, shareCount: p.shareCount,
    at: p.publishedAt ?? p.createdAt,
  });
  await prisma.tareeqPost.update({ where: { id: postId }, data: { hotScore } });
}

export function rescoreSoon(postId: string | null | undefined): void {
  if (!postId) return;
  void rescorePost(postId).catch(err => console.error('[tareeq-rescore]', postId, err));
}
