export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import TareeqUserClient from './TareeqUserClient';

interface Props { params: { userId: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { name: true, avatarUrl: true },
  });
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
  const { userId } = params;

  const [profileUser, rawPosts, postCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true, coverUrl: true, createdAt: true },
    }),
    prisma.tareeqPost.findMany({
      where: { userId },
      take: 13,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, summary: true, content: true,
        category: true, tags: true, imageUrl: true, videoUrl: true,
        authorName: true, likeCount: true, commentCount: true, createdAt: true, userId: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.tareeqPost.count({ where: { userId } }),
  ]);

  if (!profileUser) notFound();

  const hasMore = rawPosts.length > 12;
  const posts = hasMore ? rawPosts.slice(0, 12) : rawPosts;
  const nextCursor = hasMore ? posts[posts.length - 1].id : null;

  const serializedPosts = posts.map(p => ({
    ...p,
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : null,
    createdAt: p.createdAt.toISOString(),
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
