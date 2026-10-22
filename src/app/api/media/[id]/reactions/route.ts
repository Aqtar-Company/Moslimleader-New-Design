export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';
import { isReactionType, reactionSummaries } from '@/lib/free-media-social';

/** GET — counts per reaction and the viewer's own. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const viewer = await getAuthUser().catch(() => null);
  const s = (await reactionSummaries([id], viewer?.userId ?? null)).get(id);
  return NextResponse.json(s);
}

/**
 * POST { type } — set the viewer's reaction; the same type again, or `type: null`, takes it
 * back. One reaction per member per item, like a طريق post.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'سجّل الدخول للتفاعل', needsLogin: true }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const rl = await tareeqRateLimit('media-react', user.userId, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول بعد قليل' }, { status: 429 });

  const item = await prisma.freeMedia.findFirst({ where: { id, isPublished: true }, select: { id: true } });
  if (!item) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const existing = await prisma.freeMediaReaction.findUnique({ where: { mediaId_userId: { mediaId: id, userId: user.userId } } });
  const type = body.type === null ? null : isReactionType(body.type) ? body.type : undefined;
  if (type === undefined) return NextResponse.json({ error: 'تفاعل غير معروف' }, { status: 400 });

  if (!type || existing?.type === type) {
    await prisma.freeMediaReaction.deleteMany({ where: { mediaId: id, userId: user.userId } });
  } else {
    await prisma.freeMediaReaction.upsert({
      where: { mediaId_userId: { mediaId: id, userId: user.userId } },
      create: { mediaId: id, userId: user.userId, type },
      update: { type },
    });
  }
  const s = (await reactionSummaries([id], user.userId)).get(id);
  return NextResponse.json(s);
}
