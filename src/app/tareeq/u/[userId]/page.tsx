export const dynamic = 'force-dynamic';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import TareeqUserClient from './TareeqUserClient';

interface Props { params: { userId: string } }

// Resolve a handle (username or cuid) to a user row — username first, then id.
// Wrapped in cache() so generateMetadata and the page component share one DB hit.
const resolveUser = cache(async function resolveUser(handle: string) {
  const byUsername = await prisma.user.findUnique({
    where: { username: handle },
    select: { id: true, name: true, username: true, avatarUrl: true, coverUrl: true, createdAt: true },
  });
  if (byUsername) return byUsername;
  return prisma.user.findUnique({
    where: { id: handle },
    select: { id: true, name: true, username: true, avatarUrl: true, coverUrl: true, createdAt: true },
  });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await resolveUser(params.userId);
  if (!user) return { title: 'طريق' };
  const ogImage = user.avatarUrl ?? '/Tareeq-big.png';
  return {
    title: `${user.name} — طريق`,
    openGraph: {
      title: `${user.name} — طريق`,
      description: `تابع مسيرة ${user.name} على منصة طريق`,
      images: [{ url: ogImage, width: 512, height: 512, alt: user.name }],
    },
    twitter: {
      card: 'summary',
      title: `${user.name} — طريق`,
      images: [ogImage],
    },
  };
}

export default async function TareeqUserPage({ params }: Props) {
  const profileUser = await resolveUser(params.userId);
  if (!profileUser) notFound();

  const userId = profileUser.id;

  const [rawPosts, postCount] = await Promise.all([
    prisma.tareeqPost.findMany({
      where: { userId, isHidden: false },
      take: 13,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, summary: true, content: true,
        category: true, tags: true, imageUrl: true, imageUrls: true, videoUrl: true,
        authorName: true, likeCount: true, commentCount: true, savedCount: true,
        createdAt: true, userId: true,
        pinnedCommentId: true, postUpdate: true, postUpdateAt: true,
        seriesId: true, seriesTitle: true, seriesOrder: true,
        user: { select: { id: true, name: true, avatarUrl: true, role: true } },
        reactions: { distinct: ['type'], select: { type: true }, take: 4 },
      },
    }),
    prisma.tareeqPost.count({ where: { userId, isHidden: false } }),
  ]);

  const hasMore = rawPosts.length > 12;
  const posts = hasMore ? rawPosts.slice(0, 12) : rawPosts;
  const nextCursor = hasMore ? posts[posts.length - 1].id : null;

  const serializedPosts = posts.map(p => ({
    ...p,
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : null,
    createdAt: p.createdAt.toISOString(),
    postUpdateAt: p.postUpdateAt ? p.postUpdateAt.toISOString() : null,
    topReactions: p.reactions?.map((r: { type: string }) => r.type) ?? [],
    reactions: undefined,
  }));

  const serializedUser = {
    ...profileUser,
    coverUrl: profileUser.coverUrl ?? null,
    createdAt: profileUser.createdAt.toISOString(),
  };

  // Fetch liked IDs for the current viewer (best-effort)
  let likedIds: string[] = [];
  try {
    const viewer = await getAuthUser();
    const likes = await prisma.tareeqLike.findMany({
      where: { userId: viewer.userId, postId: { in: posts.map(p => p.id) } },
      select: { postId: true },
    });
    likedIds = likes.map(l => l.postId);
  } catch {
    // unauthenticated — empty likedIds is fine
  }

  return (
    <TareeqUserClient
      profileUser={serializedUser}
      initialPosts={serializedPosts}
      initialCursor={nextCursor}
      likedIds={likedIds}
      postCount={postCount}
    />
  );
}
