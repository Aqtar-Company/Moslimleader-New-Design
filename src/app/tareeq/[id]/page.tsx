export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import TareeqPostClient from './TareeqPostClient';
import type { Metadata } from 'next';

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

  // Use post image if available, else fall back to generated OG image route
  const ogImage = post.imageUrl
    ? post.imageUrl
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

  // Increment view (non-blocking)
  prisma.tareeqPost.update({ where: { id: params.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  // Check current user's reactions
  let userLiked = false;
  let userBookmarked = false;
  try {
    const currentUser = await getAuthUser();
    const [like, bookmark] = await Promise.all([
      prisma.tareeqLike.findUnique({ where: { postId_userId: { postId: params.id, userId: currentUser.userId } } }),
      prisma.tareeqBookmark.findUnique({ where: { postId_userId: { postId: params.id, userId: currentUser.userId } } }),
    ]);
    userLiked = !!like;
    userBookmarked = !!bookmark;
  } catch { /* not logged in */ }

  return (
    <TareeqPostClient
      post={{
        ...post,
        tags: post.tags as string[] | null,
        createdAt: post.createdAt.toISOString(),
        comments: post.comments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
      }}
      userLiked={userLiked}
      userBookmarked={userBookmarked}
    />
  );
}
