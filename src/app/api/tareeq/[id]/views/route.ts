export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { recordPostView } from '@/lib/tareeq-views';

// NOTE: there is deliberately no POST here any more. It was an unauthenticated,
// unmetered "increment this post's viewCount" endpoint that nothing in the app called —
// views are recorded server-side by the SSR page and by GET /api/tareeq/[id], both via
// recordPostView(). Re-adding a public POST would need an IP rate limit at minimum.

// GET — return viewer list (post author only, last 50 unique viewers)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { userId: true, viewCount: true } });
    if (!post || post.userId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Get last 50 unique named viewers (logged-in users only)
    const views = await prisma.tareeqPostView.findMany({
      where: { postId: params.id, userId: { not: null } },
      select: { userId: true, createdAt: true, user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId'],
      take: 50,
    });

    return NextResponse.json({ viewCount: post.viewCount, viewers: views.map((v: { user: { id: string; name: string; avatarUrl: string | null } | null }) => v.user).filter(Boolean) });
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
