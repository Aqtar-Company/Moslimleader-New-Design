export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended } from '@/lib/tareeq-guard';

/**
 * Publish a draft (POST) or discard it (DELETE).
 *
 * Publishing sets `publishedAt` rather than touching `createdAt`: a post drafted last week
 * and published today must sit at the top of the feed, not a week deep in it. The feed
 * still orders by `createdAt` today — `publishedAt` is recorded now so that ordering can
 * move to it without a backfill.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // A suspended member must not be able to publish through the drafts door either — the
  // whole point of the suspension check living on every creating route.
  if (await isTareeqSuspended(me.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const rl = await tareeqRateLimit('publish-draft', me.userId, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  // updateMany scoped by userId, not findUnique-then-update: it makes "is this mine?" part
  // of the write instead of a separate check something could slip between.
  const res = await prisma.tareeqPost.updateMany({
    where: { id: params.id, userId: me.userId, isDraft: true },
    data: { isDraft: false, publishedAt: new Date() },
  });

  if (res.count === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id: params.id });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // `isDraft: true` in the filter is what stops this becoming a second delete-post
  // endpoint without that route's checks.
  const res = await prisma.tareeqPost.deleteMany({
    where: { id: params.id, userId: me.userId, isDraft: true },
  });

  if (res.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
