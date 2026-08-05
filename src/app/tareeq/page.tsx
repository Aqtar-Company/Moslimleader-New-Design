export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import TareeqClient from './TareeqClient';

export const metadata: Metadata = {
  title: 'طريق — مسلم ليدر',
  description: 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — شارك تجربتك واترك علامة يهتدي بها غيرك',
};

export default async function TareeqPage() {
  let initialPosts: any[] = [];
  let initialCursor: string | null = null;

  try {
    const posts = await prisma.tareeqPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 13,
      select: {
        id: true, title: true, summary: true, content: true,
        category: true, tags: true, imageUrl: true, videoUrl: true, authorName: true,
        likeCount: true, commentCount: true, createdAt: true, userId: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    const hasMore = posts.length > 12;
    initialPosts = hasMore ? posts.slice(0, 12) : posts;
    initialCursor = hasMore ? initialPosts[initialPosts.length - 1].id : null;
  } catch { /* show empty state */ }

  return (
    <TareeqClient
      initialPosts={initialPosts.map(p => ({ ...p, createdAt: p.createdAt.toISOString() }))}
      initialCursor={initialCursor}
    />
  );
}
