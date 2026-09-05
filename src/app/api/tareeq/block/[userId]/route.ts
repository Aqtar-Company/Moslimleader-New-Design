export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';

// GET — is the current user blocking this profile, or blocked by it
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ blocking: false, blockedBy: false });

  const [blocking, blockedBy] = await Promise.all([
    prisma.tareeqBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: user.userId, blockedId: params.userId } },
    }),
    prisma.tareeqBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: params.userId, blockedId: user.userId } },
    }),
  ]);

  // Never reveal to the blocked user that they are blocked — always return false for blockedBy
  return NextResponse.json({ blocking: !!blocking, blockedBy: false });
}

// POST — toggle block/unblock. Blocking someone stops them from DMing you
// (existing conversations included), hides their live presence from you and
// yours from them, and hides their posts from your feed. There was
// previously no way at all for a user to do this to someone harassing them.
export async function POST(_req: NextRequest, { params }: { params: { userId: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.userId === params.userId) {
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
  }

  const rl = tareeqRateLimit('block', user.userId, 30, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const existing = await prisma.tareeqBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: user.userId, blockedId: params.userId } },
  });

  if (existing) {
    await prisma.tareeqBlock.deleteMany({ where: { blockerId: user.userId, blockedId: params.userId } });
    return NextResponse.json({ blocking: false });
  }

  try {
    await prisma.tareeqBlock.create({ data: { blockerId: user.userId, blockedId: params.userId } });
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e;
  }
  // Blocking severs the follow relationship in both directions — staying
  // "followed" by (or following) someone you just blocked defeats the point.
  await prisma.tareeqFollow.deleteMany({
    where: {
      OR: [
        { followerId: user.userId, followingId: params.userId },
        { followerId: params.userId, followingId: user.userId },
      ],
    },
  });
  return NextResponse.json({ blocking: true });
}
