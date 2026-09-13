export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended, isBlockedEitherWay } from '@/lib/tareeq-guard';
import { notifyTareeq } from '@/lib/tareeq-notify';
import { filterContent } from '@/lib/tareeq-content-filter';
import { displayMentions } from '@/lib/tareeq-mentions';

// GET /api/tareeq/[id]/comments?cursor=xxx&parentId=xxx
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await getAuthUser().catch(() => null);

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const cursor = req.nextUrl.searchParams.get('cursor') || undefined;
  const parentId = req.nextUrl.searchParams.get('parentId') || null;
  const limit = 50;

  const where = {
    postId: params.id,
    isHidden: false,
    parentId: parentId ?? null,
  };

  const comments = await prisma.tareeqComment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, content: true, createdAt: true, editedAt: true, userId: true, parentId: true,
      user: { select: { id: true, name: true } },
      _count: { select: { replies: true, reactions: true } },
    },
  });

  const hasMore = comments.length > limit;
  const items = hasMore ? comments.slice(0, limit) : comments;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Fetch which comments the current user reacted to (one batch query)
  let myReactionMap = new Map<string, string>();
  if (authResult && items.length > 0) {
    const myReactions = await prisma.tareeqCommentReaction.findMany({
      where: { commentId: { in: items.map(c => c.id) }, userId: authResult.userId },
      select: { commentId: true, type: true },
    });
    for (const r of myReactions) myReactionMap.set(r.commentId, r.type);
  }

  // Fetch reaction counts per comment
  const reactionRows = items.length > 0 ? await prisma.tareeqCommentReaction.groupBy({
    by: ['commentId', 'type'],
    where: { commentId: { in: items.map(c => c.id) } },
    _count: true,
  }) : [];
  const reactionCountMap = new Map<string, Record<string, number>>();
  for (const r of reactionRows) {
    if (!reactionCountMap.has(r.commentId)) reactionCountMap.set(r.commentId, {});
    reactionCountMap.get(r.commentId)![r.type] = r._count;
  }

  const shaped = items.map(c => ({
    id: c.id, content: c.content, createdAt: c.createdAt,
    editedAt: c.editedAt,
    userId: c.userId, parentId: c.parentId,
    user: c.user,
    replyCount: c._count.replies,
    likeCount: c._count.reactions,
    liked: myReactionMap.has(c.id),
    likedType: myReactionMap.get(c.id) ?? null,
    reactionCounts: reactionCountMap.get(c.id) ?? {},
  }));
  return NextResponse.json({ comments: shaped, nextCursor });
}

// POST /api/tareeq/[id]/comments
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const rl = await tareeqRateLimit('comment', user.userId, 20, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(user.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  const parentId: string | undefined = body.parentId || undefined;

  if (content.length < 2) return NextResponse.json({ error: 'اكتب تعليقك' }, { status: 400 });
  if (content.length > 500) return NextResponse.json({ error: 'التعليق طويل جداً' }, { status: 400 });

  const commentFilter = filterContent(content);
  const commentAutoHide = commentFilter.flagged;

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { id: true, userId: true, title: true, imageUrl: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  if (post.userId && await isBlockedEitherWay(user.userId, post.userId)) {
    return NextResponse.json({ error: 'لا يمكن التعليق على هذا المنشور' }, { status: 403 });
  }

  // Validate parentId belongs to this post
  let parentAuthorId: string | null = null;
  if (parentId) {
    const parent = await prisma.tareeqComment.findUnique({
      where: { id: parentId },
      select: { id: true, postId: true, userId: true },
    });
    if (!parent || parent.postId !== params.id) {
      return NextResponse.json({ error: 'تعليق غير صالح' }, { status: 400 });
    }
    parentAuthorId = parent.userId;
  }

  const [comment] = await prisma.$transaction([
    prisma.tareeqComment.create({
      data: {
        postId: params.id, userId: user.userId, content,
        ...(parentId ? { parentId } : {}),
        ...(commentAutoHide ? { isHidden: true, hiddenBy: 'auto-filter' } : {}),
      },
      select: {
        id: true, content: true, createdAt: true, editedAt: true, userId: true, parentId: true,
        user: { select: { id: true, name: true } },
      },
    }),
    // Only increment commentCount for top-level comments
    ...(!parentId ? [prisma.tareeqPost.update({ where: { id: params.id }, data: { commentCount: { increment: 1 } } })] : []),
  ]);

  const commenterName = comment.user?.name ?? 'شخص ما';

  // Parse @mentions and notify mentioned users (non-blocking, max 3)
  // Two accepted forms: @handle (no spaces) and @[Full Name] for names that contain
  // spaces. The old single pattern stopped at the first space, so selecting "Ahmed Ali"
  // from the dropdown stored "@Ahmed" and notified the wrong person — or nobody.
  const mentionRe = /@\[([^\]\n]{1,60})\]|@([؀-ۿa-zA-Z0-9_][^\s@]{0,39})/g;
  const tokens: string[] = [];
  for (const m of content.matchAll(mentionRe)) {
    // Trailing punctuation is part of the sentence, not of the handle: "@ahmed!" and
    // "(@ahmed)" are how people actually type, and `[^\s@]` swallowed it into the name.
    const raw = (m[1] ?? m[2] ?? '').trim().replace(/[.,،!?؟:;)\]}'"«»…]+$/u, '');
    if (raw) tokens.push(raw);
    if (tokens.length >= 3) break;
  }
  if (tokens.length > 0) {
    const names = tokens;
    prisma.user.findMany({
      where: { OR: [{ username: { in: names } }, { name: { in: names } }] },
      select: { id: true },
      // Display names are NOT unique. Without a cap, "@[محمد]" fans out a notification to
      // every user with that exact name — three tokens per comment, unbounded each.
      take: 10,
    })
      .then(async mentioned => {
        // The dropdown already hides blocked users, but the token is plain text: typing
        // a handle by hand was a way to notify someone who had blocked you.
        const blocks = await prisma.tareeqBlock.findMany({
          where: {
            OR: [
              { blockerId: user.userId, blockedId: { in: mentioned.map(m => m.id) } },
              { blockedId: user.userId, blockerId: { in: mentioned.map(m => m.id) } },
            ],
          },
          select: { blockerId: true, blockedId: true },
        }).catch(() => []);
        const blocked = new Set(blocks.flatMap(b => [b.blockerId, b.blockedId]));
        for (const m of mentioned) {
          if (blocked.has(m.id)) continue;
          void notifyTareeq({
            userId: m.id, type: 'mention',
            actorId: user.userId, actorName: commenterName,
            postId: params.id, postTitle: post.title ?? null,
            body: displayMentions(content).slice(0, 120),
          });
        }
      }).catch(() => {});
  }

  // Notify comment author when someone replies (non-blocking)
  if (parentId && parentAuthorId) {
    void notifyTareeq({
      userId: parentAuthorId, type: 'comment',
      actorId: user.userId, actorName: commenterName,
      postId: post.id, postTitle: post.title ?? null,
      body: displayMentions(content).slice(0, 120),
      push: {
        title: 'طريق ★',
        body: `${commenterName} ردّ على تعليقك: ${content.slice(0, 60)}`,
        url: `/tareeq/${post.id}`,
        tag: `reply-${parentId}`,
        type: 'comment',
        postId: post.id,
        image: post.imageUrl ?? undefined,
      },
    });
  }

  // Notify post author (non-blocking)
  if (!parentId && post.userId) {
    const actorName = user.name ?? 'شخص ما';
    void notifyTareeq({
      userId: post.userId, type: 'comment',
      actorId: user.userId, actorName,
      postId: post.id, postTitle: post.title ?? null,
      body: displayMentions(content).slice(0, 120),
      push: {
        title: 'طريق ★',
        body: `${actorName} علّق على علامتك: ${content.slice(0, 60)}`,
        url: `/tareeq/${post.id}`,
        tag: `comment-${post.id}`,
        type: 'comment',
        postId: post.id,
        image: post.imageUrl ?? undefined,
      },
    });
  }

  // Notify post subscribers (non-blocking)
  if (!parentId) {
    prisma.tareeqPostSubscription.findMany({
      where: { postId: params.id },
      select: { userId: true },
    }).then(async (subs) => {
      for (const sub of subs) {
        // The post author already got the 'comment' notification above; without this a
        // subscribed author is told twice about the same comment.
        if (sub.userId === post.userId) continue;
        await notifyTareeq({
          userId: sub.userId, type: 'subscribed_comment',
          actorId: user.userId, actorName: commenterName,
          postId: post.id, postTitle: post.title ?? null,
          body: displayMentions(content).slice(0, 120),
          push: {
            title: `${commenterName} — طريق`,
            body: content.slice(0, 80),
            url: `/tareeq/${post.id}`,
            tag: `sub-comment-${post.id}`,
            type: 'comment',
            postId: post.id,
            image: post.imageUrl ?? undefined,
          },
        });
      }
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, comment: { ...comment, replyCount: 0 } });
}
