export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';
import { filterContent } from '@/lib/tareeq-content-filter';

/**
 * Edit (PATCH) and delete (DELETE) a comment.
 *
 * Neither existed. A comment could be written and then never touched again — no typo
 * fixed, nothing withdrawn. On a platform whose comments are paragraphs rather than
 * one-liners that is not a small gap: the only way out of a mistake was to leave it there.
 *
 * ## Who may do what
 *
 * - **Edit:** the author only. Not the post's owner, and not an admin — editing someone
 *   else's words under their name is forgery, whatever the intent. Moderators hide a
 *   comment, they do not rewrite it.
 * - **Delete:** the author, OR the owner of the post it sits on. The second is deliberate:
 *   a post is someone's page, and being unable to remove something from it is what makes
 *   people stop writing.
 */

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_LEN = 3000;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await tareeqRateLimit('comment-edit', me.userId, 30, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim().slice(0, MAX_LEN);
  if (content.length < 1) {
    return NextResponse.json({ error: 'التعليق فارغ' }, { status: 400 });
  }

  const comment = await prisma.tareeqComment.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, createdAt: true, isHidden: true },
  });
  if (!comment) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (comment.userId !== me.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  // A comment a moderator hid must not be editable back into something acceptable.
  if (comment.isHidden) {
    return NextResponse.json({ error: 'هذا التعليق مخفي' }, { status: 403 });
  }
  // A day, not forever. Editing a year-old comment that people replied to changes what
  // the thread says after everyone has stopped reading it.
  if (Date.now() - comment.createdAt.getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: 'انتهت مهلة التعديل (24 ساعة)' }, { status: 403 });
  }

  // The same filter the original passed through — an edit is not a way around it.
  const filtered = filterContent(content);
  if (filtered.flagged) {
    return NextResponse.json({ error: 'المحتوى غير مسموح' }, { status: 400 });
  }

  const updated = await prisma.tareeqComment.update({
    where: { id: params.id },
    data: { content, editedAt: new Date() },
    select: { id: true, content: true, editedAt: true },
  });

  return NextResponse.json({
    ok: true,
    comment: { ...updated, editedAt: updated.editedAt?.toISOString() ?? null },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const comment = await prisma.tareeqComment.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, postId: true, parentId: true, post: { select: { userId: true } } },
  });
  if (!comment) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const isAuthor = comment.userId === me.userId;
  const ownsThePost = comment.post?.userId === me.userId;
  if (!isAuthor && !ownsThePost) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // The counter only ever counted top-level comments (see the POST handler), so only
  // those may decrement it — otherwise deleting replies drives it negative.
  await prisma.$transaction([
    prisma.tareeqComment.delete({ where: { id: params.id } }),
    ...(!comment.parentId
      ? [prisma.tareeqPost.update({
          where: { id: comment.postId },
          data: { commentCount: { decrement: 1 } },
        })]
      : []),
  ]);

  return NextResponse.json({ ok: true, deletedBy: isAuthor ? 'author' : 'post-owner' });
}
