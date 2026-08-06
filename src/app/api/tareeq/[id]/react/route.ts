export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

const VALID_TYPES = ['inspired', 'thanks', 'agree', 'yarabb'] as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await getAuthUser().catch(() => null);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authResult;

  const body = await req.json().catch(() => ({}));
  const { type } = body;
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const existing = await prisma.tareeqReaction.findUnique({
    where: { postId_userId: { postId: params.id, userId: me.userId } },
  });

  if (existing?.type === type) {
    // Same reaction — toggle off
    await prisma.tareeqReaction.delete({ where: { id: existing.id } });
    await prisma.tareeqPost.update({ where: { id: params.id }, data: { likeCount: { decrement: 1 } } });
    return NextResponse.json({ reaction: null });
  } else if (existing) {
    // Different reaction — switch (no likeCount change)
    await prisma.tareeqReaction.update({ where: { id: existing.id }, data: { type } });
    return NextResponse.json({ reaction: type });
  } else {
    // New reaction
    await prisma.tareeqReaction.create({ data: { postId: params.id, userId: me.userId, type } });
    await prisma.tareeqPost.update({ where: { id: params.id }, data: { likeCount: { increment: 1 } } });
    return NextResponse.json({ reaction: type });
  }
}

// GET — fetch reaction counts for a post
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const reactions = await prisma.tareeqReaction.groupBy({
    by: ['type'],
    where: { postId: params.id },
    _count: { type: true },
  });
  const counts: Record<string, number> = {};
  for (const r of reactions) counts[r.type] = r._count.type;
  return NextResponse.json({ counts });
}
