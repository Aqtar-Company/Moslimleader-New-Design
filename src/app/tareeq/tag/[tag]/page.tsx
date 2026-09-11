export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import CategoryPageClient from '../../category/[slug]/CategoryPageClient';
import { SHARED_FROM_SELECT, normalizeSharedFrom } from '@/lib/tareeq-post-select';

interface Props {
  params: { tag: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag);
  return {
    title: `#${tag} — طريق`,
    description: `العلامات الموسومة بـ #${tag} على منصة طريق`,
  };
}

/**
 * Posts carrying one tag.
 *
 * Tags were the platform's cheapest discovery path and it did not exist: the composer
 * accepted up to ten per post, the API stored them, and nothing read them back — no page,
 * and not even a rendering on the card. Every tag anyone had written was dead data.
 *
 * `tags` is a MySQL JSON column, which Prisma cannot filter on, so the match is a raw
 * `JSON_CONTAINS`. That is a table scan — acceptable here because a tag page is a rare,
 * deliberate navigation rather than something on the hot feed path, and the ids come back
 * bounded to 60. If tags become a main entry point, they want their own join table.
 */
export default async function TagPage({ params }: Props) {
  const tag = decodeURIComponent(params.tag).trim();

  let posts: any[] = [];
  try {
    // Two steps on purpose: the raw query finds the ids, and Prisma loads the rows with
    // the same `select` the rest of Tareeq uses. Hand-writing that join in SQL would
    // duplicate the share-embed shape, and it has drifted before.
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM TareeqPost
      WHERE isHidden = false
        AND isDraft = false
        AND JSON_CONTAINS(tags, JSON_QUOTE(${tag}))
      ORDER BY createdAt DESC
      LIMIT 60
    `;
    const ids = rows.map(r => r.id);

    if (ids.length) {
      const found = await prisma.tareeqPost.findMany({
        where: { id: { in: ids } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, summary: true, content: true,
          category: true, tags: true, imageUrl: true, imageAlt: true, videoUrl: true, thumbnailUrl: true,
          authorName: true, likeCount: true, commentCount: true,
          createdAt: true, userId: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
          ...SHARED_FROM_SELECT,
        },
      });
      posts = found;
    }
  } catch { /* show empty state */ }

  const serialized = posts.map((p: any) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    isUseful: false,
    sharedFrom: normalizeSharedFrom(p.sharedFrom),
  }));

  return (
    <CategoryPageClient
      catKey={`tag:${tag}`}
      catAr={`#${tag}`}
      catEn={`#${tag}`}
      icon="#"
      accent="#d4a853"
      posts={serialized}
    />
  );
}
