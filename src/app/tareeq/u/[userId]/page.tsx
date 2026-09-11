export const dynamic = 'force-dynamic';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import TareeqUserClient from './TareeqUserClient';
import { SHARED_FROM_SELECT, normalizeSharedFrom } from '@/lib/tareeq-post-select';

interface Props { params: { userId: string } }

// Resolve a handle (username or cuid) to a user row — username first, then id.
// Wrapped in cache() so generateMetadata and the page component share one DB hit.
const resolveUser = cache(async function resolveUser(handle: string) {
  const byUsername = await prisma.user.findUnique({
    where: { username: handle },
    select: { id: true, name: true, username: true, avatarUrl: true, coverUrl: true, createdAt: true, tareeqMessagePrivacy: true },
  });
  if (byUsername) return byUsername;
  return prisma.user.findUnique({
    where: { id: handle },
    select: { id: true, name: true, username: true, avatarUrl: true, coverUrl: true, createdAt: true, tareeqMessagePrivacy: true },
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

  // Resolve the viewer + block relationship BEFORE deciding what to send: rendering
  // initialPosts unconditionally and only hiding them client-side (after an async check)
  // let a blocked viewer see the first paint of content either side blocked. Checked in
  // both directions — blocking someone should hide their posts from you just as being
  // blocked by them should.
  let viewerId: string | null = null;
  let isOwner = false;
  try {
    // getAuthUser() returns null for a guest (no cookie) rather than throwing — only an
    // unexpected error throws, which the catch below treats the same as "no viewer".
    const viewer = await getAuthUser();
    if (viewer) {
      viewerId = viewer.userId;
      isOwner = viewer.userId === profileUser.id;
    }
  } catch {
    // unauthenticated — treated as a non-blocked anonymous viewer below
  }
  // The two directions are kept separate on purpose. Posts are hidden either way, but
  // the UI must not TELL a user they've been blocked — /api/tareeq/block deliberately
  // never returns blockedBy for that reason, so surfacing an explicit "Unavailable"
  // state in that direction would leak exactly what that endpoint withholds.
  let viewerIsBlocking = false;   // viewer blocked this profile — safe to show explicitly
  let blockedByProfile = false;   // profile blocked viewer — must look like an empty profile
  if (!isOwner && viewerId) {
    const rows = await prisma.tareeqBlock.findMany({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: profileUser.id },
          { blockerId: profileUser.id, blockedId: viewerId },
        ],
      },
      select: { blockerId: true },
    });
    viewerIsBlocking = rows.some(r => r.blockerId === viewerId);
    blockedByProfile = rows.some(r => r.blockerId === profileUser.id);
  }
  const blocked = viewerIsBlocking || blockedByProfile;

  const [rawPosts, postCount] = blocked
    ? [[], 0]
    : await Promise.all([
        prisma.tareeqPost.findMany({
          where: { userId, isHidden: false },
          take: 13,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, title: true, summary: true, content: true,
            category: true, tags: true, imageUrl: true, imageUrls: true, videoUrl: true, thumbnailUrl: true,
            authorName: true, likeCount: true, commentCount: true, savedCount: true,
            createdAt: true, userId: true,
            pinnedCommentId: true, postUpdate: true, postUpdateAt: true,
            seriesId: true, seriesTitle: true, seriesOrder: true,
            user: { select: { id: true, name: true, avatarUrl: true, role: true } },
            ...SHARED_FROM_SELECT,
            reactions: { distinct: ['type'], orderBy: { createdAt: 'desc' as const }, select: { type: true }, take: 40 },
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
    sharedFrom: normalizeSharedFrom(p.sharedFrom),
  }));

  // Fetch liked IDs for the current viewer (best-effort) — skipped entirely when blocked
  let likedIds: string[] = [];
  if (viewerId && !blocked) {
    try {
      const likes = await prisma.tareeqLike.findMany({
        where: { userId: viewerId, postId: { in: posts.map(p => p.id) } },
        select: { postId: true },
      });
      likedIds = likes.map(l => l.postId);
    } catch { /* best-effort */ }
  }

  // Only expose tareeqMessagePrivacy to the profile owner — hide from public HTML
  const serializedUser = {
    id: profileUser.id,
    name: profileUser.name,
    username: profileUser.username ?? null,
    avatarUrl: profileUser.avatarUrl ?? null,
    coverUrl: profileUser.coverUrl ?? null,
    createdAt: profileUser.createdAt.toISOString(),
    ...(isOwner ? { tareeqMessagePrivacy: profileUser.tareeqMessagePrivacy ?? 'everyone' } : {}),
  };

  return (
    <TareeqUserClient
      profileUser={serializedUser}
      initialPosts={serializedPosts}
      initialCursor={nextCursor}
      likedIds={likedIds}
      postCount={postCount}
      initialBlocked={viewerIsBlocking}
    />
  );
}
