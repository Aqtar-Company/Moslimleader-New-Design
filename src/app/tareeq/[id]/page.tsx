export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import TareeqPostClient from './TareeqPostClient';

export default async function TareeqPostPage({ params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true } },
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

  // Increment view
  prisma.tareeqPost.update({ where: { id: params.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return (
    <TareeqPostClient
      post={{
        ...post,
        createdAt: post.createdAt.toISOString(),
        tags: post.tags as string[] | null,
        comments: post.comments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
      }}
    />
  );
}
