export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordPostView } from '@/lib/tareeq-views';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended } from '@/lib/tareeq-guard';
import { filterContent } from '@/lib/tareeq-content-filter';
import { CATEGORY_KEY } from '@/lib/tareeq-constants';

// GET /api/tareeq/[id] — returns post + userLiked + userBookmarked
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true, content: true, createdAt: true, userId: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // Resolve current user once for both view recording and like/bookmark checks
  const authUser = await getAuthUser().catch(() => null);

  /**
   * A draft is its author's alone, and this route returned the whole row to anyone with
   * the id — which was being printed in the author's public profile markup. The SSR page
   * has the same guard; this is the JSON door to the same data, and it also records a
   * view, so drafts were accruing `viewCount` from strangers.
   */
  if (post.isDraft && authUser?.userId !== post.userId) {
    return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  }

  // Record view (non-blocking) — shared helper so this agrees with the SSR page instead
  // of each path counting on its own terms.
  void recordPostView(params.id, authUser?.userId ?? null, post.userId);

  // Check if current user already liked/bookmarked/subscribed
  let userLiked = false;
  let userBookmarked = false;
  let userSubscribed = false;
  try {
    if (!authUser) throw new Error('not logged in');
    const [like, bookmark, subscription] = await Promise.all([
      prisma.tareeqLike.findUnique({ where: { postId_userId: { postId: params.id, userId: authUser.userId } } }),
      prisma.tareeqBookmark.findUnique({ where: { postId_userId: { postId: params.id, userId: authUser.userId } } }),
      prisma.tareeqPostSubscription.findUnique({ where: { postId_userId: { postId: params.id, userId: authUser.userId } } }),
    ]);
    userLiked = !!like;
    userBookmarked = !!bookmark;
    userSubscribed = !!subscription;
  } catch { /* not logged in — defaults stay false */ }

  return NextResponse.json({ post, userLiked, userBookmarked, userSubscribed });
}

// PUT /api/tareeq/[id] — edit (owner only)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const rl = await tareeqRateLimit('edit', user.userId, 20, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(user.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: { userId: true, createdAt: true, videoUrl: true, imageUrl: true, sharedFromId: true },
  });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (post.userId !== user.userId) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  /**
   * 24 hours, not one — and no limit for an admin.
   *
   * One hour was strict enough that, in practice, nobody could edit anything: the typo is
   * noticed the next morning, the wrong link the day after. The site owner reported it as
   * "I cannot edit any post", and that was an accurate description of the experience. A
   * day covers the real cases; an admin fixing their own platform's posts should never
   * be told to wait.
   */
  const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
  const isAdmin = user.role === 'admin';
  if (!isAdmin && Date.now() - post.createdAt.getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: 'انتهت مهلة التعديل (24 ساعة)' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  const title = String(body.title ?? '').trim().slice(0, 120) || null;
  // Same map the create route validates against. `undefined` means "leave it alone", so a
  // client that does not send the field cannot accidentally clear the category.
  const rawCategory = body.category === undefined ? undefined : String(body.category ?? '').trim();
  const category = rawCategory === undefined ? undefined : (rawCategory ? (CATEGORY_KEY[rawCategory] ?? null) : null);

  // Same rule as the create route: a post that carries media, or is a share, may have a
  // short caption or none. Requiring ten characters here — while create required none —
  // made every video post with a short caption, and every share, impossible to edit; the
  // author saw a greyed Save button with no explanation.
  const hasMediaOrShare = !!(post.videoUrl || post.imageUrl || post.sharedFromId);
  if (content.length < (hasMediaOrShare ? 0 : 10)) return NextResponse.json({ error: 'اكتب أكثر' }, { status: 400 });
  if (content.length > 5000) return NextResponse.json({ error: 'النص طويل جداً' }, { status: 400 });

  // The create route runs edited text through the same content filter — an
  // edit was previously a way to reintroduce content that filter would have
  // auto-hidden at creation time, with no re-check at all.
  const filterResult = filterContent([content, title].filter(Boolean).join(' '));

  await prisma.tareeqPost.update({
    where: { id: params.id },
    data: {
      content, title, updatedAt: new Date(),
      ...(category !== undefined ? { category } : {}),
      ...(filterResult.flagged ? { isHidden: true, hiddenReason: filterResult.reason ?? 'auto-filter' } : {}),
    },
  });

  return NextResponse.json({ ok: true, flagged: filterResult.flagged });
}

// DELETE /api/tareeq/[id] — owner or admin only
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const rl = await tareeqRateLimit('delete', user.userId, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!post) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  if (post.userId !== user.userId && user.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  await prisma.tareeqPost.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
