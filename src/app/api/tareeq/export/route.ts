import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const posts = await prisma.tareeqPost.findMany({
    where: { userId: user.userId, isHidden: false },
    select: {
      id: true,
      content: true,
      category: true,
      imageUrl: true,
      videoUrl: true,
      likeCount: true,
      commentCount: true,
      viewCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    userId: user.userId,
    postCount: posts.length,
    posts,
  });
}
