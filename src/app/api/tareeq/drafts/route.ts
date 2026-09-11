export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

/**
 * The signed-in member's drafts.
 *
 * The composer already kept ONE draft, in `localStorage`. Which meant a draft started on
 * the phone did not exist on the desktop, and starting a second post silently overwrote
 * the first. A draft is now a real row, filtered out of every feed (see `isDraft` in
 * `/api/tareeq` and the two server-rendered feeds).
 *
 * The local draft is kept as well, and on purpose: it survives a closed tab before the
 * first save and works with no network. This is the durable copy, not a replacement.
 */
export async function GET() {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ drafts: [] });

  const drafts = await prisma.tareeqPost.findMany({
    where: { userId: me.userId, isDraft: true },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: {
      id: true, title: true, content: true, category: true, tags: true,
      imageUrl: true, imageAlt: true, imageUrls: true, videoUrl: true, thumbnailUrl: true,
      seriesTitle: true, seriesOrder: true, createdAt: true, updatedAt: true,
    },
  });

  return NextResponse.json({
    drafts: drafts.map(d => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
}
