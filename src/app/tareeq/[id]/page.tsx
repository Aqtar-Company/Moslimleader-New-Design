export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isBlockedEitherWay } from '@/lib/tareeq-guard';
import { recordPostView } from '@/lib/tareeq-views';
import { getAuthUser } from '@/lib/jwt';
import TareeqPostClient from './TareeqPostClient';
import type { Metadata } from 'next';
import { SHARED_FROM_INCLUDE, normalizeSharedFrom } from '@/lib/tareeq-post-select';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: { title: true, content: true, imageUrl: true, authorName: true, category: true },
  });
  if (!post) return {};

  const title = post.title ?? post.content?.slice(0, 60) ?? 'علامة في طريق';
  const description = post.content?.slice(0, 160) ?? '';
  const siteUrl = 'https://moslimleader.com';
  const pageUrl = `${siteUrl}/tareeq/${params.id}`;

  // Use the post's own image when there is one, else the generated card. Uploaded paths
  // are site-relative, and og:image must be absolute or scrapers drop it.
  const ogImage = post.imageUrl
    ? new URL(post.imageUrl, siteUrl).toString()
    : `${siteUrl}/api/tareeq/${params.id}/og`;

  return {
    title: `${title} — طريق`,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'طريق — مسلم ليدر',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function TareeqPostPage({ params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
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
