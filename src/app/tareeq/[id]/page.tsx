export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isBlockedEitherWay } from '@/lib/tareeq-guard';
import { recordPostView } from '@/lib/tareeq-views';
import { getAuthUser } from '@/lib/jwt';
import TareeqPostClient from './TareeqPostClient';
import type { Metadata } from 'next';
import { SHARED_FROM_INCLUDE, normalizeSharedFrom } from '@/lib/tareeq-post-select';

/**
 * Cuts text to at most `max` characters at a word boundary, with an ellipsis.
 *
 * A plain `slice(0, 60)` ended a share title in the middle of a word — the live card read
 * «...تف», the first two letters of «تفاصيل». In Arabic a half-word is not just ugly, it is
 * often a different word.
 */
function cutAtWord(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const lastSpace = head.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? head.slice(0, lastSpace) : head).trimEnd() + '…';
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: {
      title: true, content: true, imageUrl: true, imageAlt: true, authorName: true, category: true,
      isDraft: true, isHidden: true,
      // A video post's share image is its COVER. This select used to stop at imageUrl, so
      // every video post fell through to the generated text card: Facebook showed a
      // paragraph instead of the video's poster, and WhatsApp — which is far less patient
      // with a slow, large PNG — showed nothing at all.
      thumbnailUrl: true, videoUrl: true,
    },
  });
  // An unpublished or moderated post must not describe itself to a scraper either.
  if (!post || post.isDraft || post.isHidden) return {};

  const title = post.title ?? cutAtWord(post.content ?? '', 60) ?? 'علامة في طريق';
  const description = cutAtWord(post.content ?? '', 160);
  const siteUrl = 'https://moslimleader.com';
  const pageUrl = `${siteUrl}/tareeq/${params.id}`;

  // The post's own media wins when there is any — the image for an image post, the cover
  // for a video post. Uploaded paths may be site-relative, and og:image must be absolute
  // or scrapers drop it. With no media we set nothing here on purpose: `images` left
  // undefined is what lets Next wire up the generated card from `opengraph-image.tsx`.
  // Naming a URL here would override it.
  const mediaImage = post.imageUrl ?? (post.videoUrl ? post.thumbnailUrl : null);
  const ogImage = mediaImage ? new URL(mediaImage, siteUrl).toString() : null;
  const isVideo = !!post.videoUrl;

  return {
    title: `${title} — طريق`,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'طريق — مسلم ليدر',
      // No declared width/height: the cover is whatever the encoder produced (1280x720 for
      // a landscape clip, portrait for a portrait one) and a wrong declaration is worse
      // than none — scrapers that trust it crop to it.
      ...(ogImage ? { images: [{ url: ogImage, alt: title }] } : {}),
      type: isVideo ? 'video.other' : 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function TareeqPostPage({ params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, tareeqGender: true } },
      ...SHARED_FROM_INCLUDE,
      comments: {
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true, content: true, createdAt: true, userId: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!post) return notFound();

  // Resolve the viewer ONCE. Each getAuthUser() is a cookie read plus a jwtVerify, and for
  // an admin/staff token it also does a prisma.user lookup — this page used to pay for
  // three of them per render.
  const viewer = await getAuthUser().catch(() => null);

  /**
   * A draft belongs to its author and nobody else.
   *
   * The drafts feature filtered `isDraft` out of the feeds and stopped there, so the
   * permalink served the whole thing to anyone holding the id — and the id was printed
   * in the author's own public profile markup. Reachable, readable, and it kept working
   * through every edit until the post was published or discarded.
   */
  if (post.isDraft && (!viewer || viewer.userId !== post.userId)) return notFound();

  // A blocked author's post is not viewable by direct URL either — the feed and profile
  // both filter these out, so leaving the permalink open defeated the whole block.
  if (post.userId && viewer && viewer.userId !== post.userId
      && await isBlockedEitherWay(viewer.userId, post.userId)) {
    return notFound();
  }

  // Record view (non-blocking, deduped, skips the author) — this used to increment on
  // every single render without ever creating the viewer row the "who viewed" list reads.
  void recordPostView(params.id, viewer?.userId ?? null, post.userId);

  // Check current user's reactions + subscription
  let userLiked = false;
  let userBookmarked = false;
  let userReaction: string | null = null;
  let userSubscribed = false;
  if (viewer) {
    try {
      const [like, bookmark, reaction, subscription] = await Promise.all([
        prisma.tareeqLike.findUnique({ where: { postId_userId: { postId: params.id, userId: viewer.userId } } }),
        prisma.tareeqBookmark.findUnique({ where: { postId_userId: { postId: params.id, userId: viewer.userId } } }),
        (prisma as any).tareeqReaction?.findUnique({ where: { postId_userId: { postId: params.id, userId: viewer.userId } } }).catch(() => null) ?? null,
        prisma.tareeqPostSubscription.findUnique({ where: { postId_userId: { postId: params.id, userId: viewer.userId } } }),
      ]);
      userLiked = !!like;
      userBookmarked = !!bookmark;
      userReaction = (reaction as any)?.type ?? null;
      userSubscribed = !!subscription;
    } catch { /* best-effort */ }
  }

  return (
    <TareeqPostClient
      post={{
        ...post,
        tags: post.tags as string[] | null,
        createdAt: post.createdAt.toISOString(),
        comments: post.comments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
        postUpdate: post.postUpdate ?? null,
        postUpdateAt: post.postUpdateAt?.toISOString() ?? null,
        seriesId: post.seriesId ?? null,
        seriesTitle: post.seriesTitle ?? null,
        seriesOrder: post.seriesOrder ?? null,
        pinnedCommentId: post.pinnedCommentId ?? null,
        sharedFromId: post.sharedFromId ?? null,
        sharedFrom: normalizeSharedFrom(post.sharedFrom),
      }}
      userLiked={userLiked}
      userBookmarked={userBookmarked}
      userReaction={userReaction}
      userSubscribed={userSubscribed}
    />
  );
}
