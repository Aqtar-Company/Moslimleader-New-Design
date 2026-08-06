export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

const VALID_TYPES = ['inspired', 'thanks', 'agree', 'yarabb'] as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-react:${ip}`, 60, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const authResult = await getAuthUser().catch(() => null);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authResult;

  const body = await req.json().catch(() => ({}));
  const { type } = body;
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  // Verify post exists before any mutation
  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const existing = await prisma.tareeqReaction.findUnique({
    where: { postId_userId: { postId: params.id, userId: me.userId } },
  });

  if (existing?.type === type) {
    // Same reaction — toggle off (atomic, with floor guard on likeCount)
    await prisma.$transaction(async (tx) => {
      await tx.tareeqReaction.delete({ where: { id: existing.id } });
      await tx.$executeRaw`UPDATE \`TareeqPost\` SET likeCount = GREATEST(0, likeCount - 1) WHERE id = ${params.id}`;
    });
    return NextResponse.json({ reaction: null });
  } else if (existing) {
    // Different reaction — switch type (no likeCount change)
    await prisma.tareeqReaction.update({ where: { id: existing.id }, data: { type } });
    return NextResponse.json({ reaction: type });
  } else {
    // New reaction (atomic: create + increment)
    await prisma.$transaction([
      prisma.tareeqReaction.create({ data: { postId: params.id, userId: me.userId, type } }),
      prisma.tareeqPost.update({ where: { id: params.id }, data: { likeCount: { increment: 1 } } }),
    ]);
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
