export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendPushToUser } from '@/lib/tareeq-push';

// PATCH /api/tareeq/[id]/update — add "ماذا حدث" update to the post (owner only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = checkRateLimit(`tareeq-post-update:${user.userId}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: { update?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update = typeof body.update === 'string' ? body.update.trim() : '';
  if (update.length < 5 || update.length > 1000) {
    return NextResponse.json({ error: 'Update must be between 5 and 1000 characters' }, { status: 400 });
  }

  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, title: true },
  });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (post.userId !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.tareeqPost.update({
    where: { id: params.id },
    data: { postUpdate: update, postUpdateAt: new Date() },
  });

  // Non-blocking: notify users who liked or commented on the post
  void (async () => {
    try {
      const [likers, commenters] = await Promise.all([
        prisma.tareeqLike.findMany({
          where: { postId: params.id },
          select: { userId: true },
        }),
        prisma.tareeqComment.findMany({
          where: { postId: params.id },
          select: { userId: true },
        }),
      ]);

      const recipientIds = [
        ...new Set([
          ...likers.map((l) => l.userId),
          ...commenters.map((c) => c.userId),
        ]),
      ].filter((uid) => uid !== user.userId);

      const actorName = (user as { name?: string }).name ?? 'شخص ما';
      const snippet = update.slice(0, 120);

      await Promise.all(
        recipientIds.map(async (userId) => {
          await prisma.tareeqNotification.create({
            data: {
              userId,
              type: 'post_update',
              actorId: user.userId,
              actorName,
              postId: params.id,
              postTitle: post.title ?? null,
              body: snippet,
            },
          }).catch(() => {});

          await sendPushToUser(userId, {
            title: `${actorName} — طريق`,
            body: snippet,
            url: `/tareeq/${params.id}`,
            tag: `update-${params.id}`,
            type: 'generic',
            postId: params.id,
          }).catch(() => {});
        })
      );
    } catch {
      // non-blocking — silently ignore errors
    }
  })();

  return NextResponse.json({ ok: true });
}

// DELETE /api/tareeq/[id]/update — remove the post update (owner only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (post.userId !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.tareeqPost.update({
    where: { id: params.id },
    data: { postUpdate: null, postUpdateAt: null },
  });

  return NextResponse.json({ ok: true });
}
