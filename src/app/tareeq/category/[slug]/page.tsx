export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  TAREEQ_CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_ACCENT_HEX,
} from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import CategoryPageClient from './CategoryPageClient';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = params.slug as TareeqCategoryKey;
  const cat = TAREEQ_CATEGORIES[key];
  if (!cat) return { title: 'طريق' };
  const icon = CATEGORY_ICONS[key] ?? '';
  return {
    title: `${icon} ${cat.ar} — طريق`,
    description: `أفضل علامات تصنيف ${cat.ar} على منصة طريق`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const key = params.slug as TareeqCategoryKey;
  if (!TAREEQ_CATEGORIES[key]) notFound();

  const cat = TAREEQ_CATEGORIES[key];
  const icon = CATEGORY_ICONS[key] ?? '';
  const accent = CATEGORY_ACCENT_HEX[key] ?? '#d4a853';

  // Fetch top posts in this category sorted by likes
  let posts: any[] = [];
  let usefulPostIds: Set<string> = new Set();

  try {
    posts = await prisma.tareeqPost.findMany({
      where: { category: key },
      orderBy: { likeCount: 'desc' },
      take: 30,
      select: {
        id: true, title: true, summary: true, content: true,
        category: true, tags: true, imageUrl: true, videoUrl: true,
        authorName: true, likeCount: true, commentCount: true,
        createdAt: true, userId: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (posts.length > 0) {
      const highBookmarkRows = await prisma.tareeqBookmark.groupBy({
        by: ['postId'],
        where: { postId: { in: posts.map((p: any) => p.id) } },
        _count: { postId: true },
        having: { postId: { _count: { gte: 3 } } },
      });
      usefulPostIds = new Set(highBookmarkRows.map((r: any) => r.postId));
    }
  } catch { /* show empty state */ }

  const serialized = posts.map((p: any) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    isUseful: usefulPostIds.has(p.id),
  }));

  return (
    <CategoryPageClient
      catKey={key}
      catAr={cat.ar}
      catEn={cat.en}
      icon={icon}
      accent={accent}
      posts={serialized}
    />
  );
}
