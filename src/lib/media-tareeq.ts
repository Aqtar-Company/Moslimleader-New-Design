/**
 * The media library ↔ طريق bridge. Server-only.
 *
 * Every published item has at most ONE discussion post in طريق (FreeMedia.discussionPostId).
 * Its comments and reactions are what /media shows, so «شاركنا رأيك» under a nasheed and a
 * comment on its post in the feed are the same conversation, not two that never meet.
 *
 * The post is made either when the admin publishes the item to طريق («انشر في طريق» —
 * dated now, it is news) or lazily on the first comment/reaction (dated to the item's own
 * date, so a two-year-old story does not jump to the top of everyone's feed).
 *
 * Comments and reactions written before the bridge live in FreeMediaComment /
 * FreeMediaReaction. They are MOVED into the post when it is made, in the same transaction,
 * so after that there is one place to read — no union, no double counting.
 */
import { prisma } from '@/lib/prisma';
import { mediaPostCategory } from '@/lib/media-story-category.mjs';
import { computeHotScore } from '@/lib/tareeq-rank';
import { notifyTareeq } from '@/lib/tareeq-notify';
import { mediaPath, TYPE_TO_KIND } from '@/lib/free-media-shared';

/** Setting holding the user id that official media posts are written as. */
export const OFFICIAL_AUTHOR_KEY = 'tareeq-official-author';

/** The author of official posts: the Setting if it names a real user, else the oldest admin. */
export async function officialAuthor(): Promise<{ id: string; name: string } | null> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: OFFICIAL_AUTHOR_KEY } });
    const id = typeof s?.value === 'string' ? s.value : null;
    if (id) {
      const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
      if (u) return { id: u.id, name: u.name ?? 'مسلم ليدر' };
    }
  } catch { /* fall through */ }
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true },
  });
  return admin ? { id: admin.id, name: admin.name ?? 'مسلم ليدر' } : null;
}

class LostRace extends Error {}

/**
 * The item's discussion post id, making it when missing. Null when the item is not
 * published or no author can be found (no admin at all).
 *
 * `fresh`: dated now (the admin is announcing it), not backdated to the item.
 * `content`: the admin's own words for an announced post.
 */
export async function ensureDiscussionPost(
  mediaId: number,
  opts: { fresh?: boolean; content?: string } = {},
): Promise<{ postId: string; created: boolean } | null> {
  const item = await prisma.freeMedia.findUnique({
    where: { id: mediaId },
    select: {
      id: true, title: true, description: true, isPublished: true, createdAt: true, discussionPostId: true,
      category: { select: { name: true, nameEn: true } },
    },
  });
  if (!item || !item.isPublished) return null;
  if (item.discussionPostId) return { postId: item.discussionPostId, created: false };

  const author = await officialAuthor();
  if (!author) return null;

  const at = opts.fresh ? new Date() : item.createdAt;
  const content = (opts.content ?? '').trim().slice(0, 5000)
    || (item.description ?? '').trim().slice(0, 600);

  try {
    const postId = await prisma.$transaction(async (tx) => {
      // Legacy rows whose writer still exists (TareeqComment/TareeqReaction need a real user).
      const [oldComments, oldReactions] = await Promise.all([
        tx.freeMediaComment.findMany({ where: { mediaId }, orderBy: { id: 'asc' } }),
        tx.freeMediaReaction.findMany({ where: { mediaId } }),
      ]);
      const ids = Array.from(new Set([...oldComments.map(c => c.userId), ...oldReactions.map(r => r.userId)]));
      const alive = new Set(
        ids.length ? (await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true } })).map(u => u.id) : [],
      );
      const comments = oldComments.filter(c => alive.has(c.userId));
      const reactions = oldReactions.filter(r => alive.has(r.userId));
      const visibleComments = comments.filter(c => !c.isHidden).length;

      const post = await tx.tareeqPost.create({
        data: {
          content,
          title: item.title.slice(0, 190),
          // A story from the library sits under the «قصة» chip like any member's story.
          category: mediaPostCategory(item),
          mediaId,
          userId: author.id,
          authorName: author.name,
          publishedAt: at,
          createdAt: at,
          likeCount: reactions.length,
          commentCount: visibleComments,
          hotScore: computeHotScore({ at, likeCount: reactions.length, commentCount: visibleComments }),
        },
        select: { id: true },
      });

      // Claim the item. Two first-commenters at once both get here; the row lock makes the
      // second wait, see a non-null id, and roll its own post back.
      const claimed = await tx.freeMedia.updateMany({
        where: { id: mediaId, discussionPostId: null },
        data: { discussionPostId: post.id },
      });
      if (claimed.count === 0) throw new LostRace();

      if (comments.length) {
        await tx.tareeqComment.createMany({
          data: comments.map(c => ({
            postId: post.id, userId: c.userId, content: c.content, isHidden: c.isHidden, createdAt: c.createdAt,
          })),
        });
      }
      if (reactions.length) {
        await tx.tareeqReaction.createMany({
          data: reactions.map(r => ({ postId: post.id, userId: r.userId, type: r.type, createdAt: r.createdAt })),
          skipDuplicates: true,
        });
      }
      await tx.freeMediaComment.deleteMany({ where: { mediaId } });
      await tx.freeMediaReaction.deleteMany({ where: { mediaId } });
      return post.id;
    }, { timeout: 20_000 });
    return { postId, created: true };
  } catch (err) {
    if (err instanceof LostRace) {
      const again = await prisma.freeMedia.findUnique({ where: { id: mediaId }, select: { discussionPostId: true } });
      return again?.discussionPostId ? { postId: again.discussionPostId, created: false } : null;
    }
    throw err;
  }
}

/**
 * «تابع التصنيف»: tell the category's followers about a newly published item, once.
 * Fire-and-forget from the admin routes — a notification never fails a save.
 */
export async function notifyCategoryFollowers(mediaId: number): Promise<void> {
  try {
    const item = await prisma.freeMedia.findUnique({
      where: { id: mediaId },
      select: {
        id: true, title: true, type: true, isPublished: true, categoryId: true, followersNotifiedAt: true,
        category: { select: { name: true } },
      },
    });
    if (!item || !item.isPublished || !item.categoryId || item.followersNotifiedAt) return;

    // Claim first, so two saves in a row cannot both send.
    const claimed = await prisma.freeMedia.updateMany({
      where: { id: mediaId, followersNotifiedAt: null },
      data: { followersNotifiedAt: new Date() },
    });
    if (claimed.count === 0) return;

    const follows = await prisma.freeMediaCategoryFollow.findMany({
      where: { categoryId: item.categoryId }, select: { userId: true },
    });
    const url = mediaPath(item.id, TYPE_TO_KIND[item.type]);
    const shelf = item.category?.name ?? 'مكتبة الوسائط';
    // Sequential on purpose: each call reads the member's preferences and may push; a burst
    // of hundreds in parallel would hold that many connections for one admin save.
    for (const f of follows) {
      await notifyTareeq({
        userId: f.userId,
        type: 'media_new',
        actorName: shelf,
        postId: String(item.id),
        postTitle: item.title,
        body: item.title,
        push: {
          title: `جديد في «${shelf}»`,
          body: item.title,
          url,
          tag: `media-${item.id}`,
          type: 'generic',
        },
      });
    }
  } catch (err) {
    console.error('[media-tareeq] follower notification failed', err);
  }
}

/**
 * What saving a PUBLISHED item sets off: the category's followers hear about it (once per
 * item, in the background), and — when the admin ticked «انشر في طريق» — its official
 * post is made now. Returns the item as it stands after, so the admin list shows the link.
 * A failure to post never fails the save; the per-item button retries it.
 */
export async function publishSideEffects<T extends { id: number; isPublished: boolean; discussionPostId: string | null }>(
  item: T,
  opts: { postToTareeq?: boolean } = {},
): Promise<T> {
  if (!item.isPublished) return item;
  void notifyCategoryFollowers(item.id);
  if (!opts.postToTareeq || item.discussionPostId) return item;
  try {
    const r = await ensureDiscussionPost(item.id, { fresh: true });
    return r ? { ...item, discussionPostId: r.postId } : item;
  } catch (err) {
    console.error('[media-tareeq] publish to Tareeq failed', err);
    return item;
  }
}
