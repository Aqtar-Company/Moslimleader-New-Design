export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';
import { filterContent } from '@/lib/tareeq-content-filter';
import { COMMENT_MAX, firstName, loadComments } from '@/lib/free-media-social';

/** GET ?before=<id> — newest first, 20 at a time. Open to everyone. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  const before = Number(req.nextUrl.searchParams.get('before'));
  const data = await loadComments(id, { beforeId: Number.isInteger(before) && before > 0 ? before : undefined });
  return NextResponse.json(data);
}

/**
 * POST { content } — signed-in members only. The same word filter طريق uses; a comment it
 * flags is refused with a reason instead of being published and hidden later — on a page
 * children watch, «it was up for a minute» is already too long.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'سجّل الدخول للتعليق', needsLogin: true }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const rl = await tareeqRateLimit('media-comment', user.userId, 8, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'تعليقات كثيرة بسرعة — انتظر دقيقة' }, { status: 429 });

  const item = await prisma.freeMedia.findFirst({ where: { id, isPublished: true }, select: { id: true } });
  if (!item) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'اكتب تعليقاً' }, { status: 400 });
  if (content.length > COMMENT_MAX) return NextResponse.json({ error: `التعليق طويل (الحد ${COMMENT_MAX} حرف)` }, { status: 400 });
  if (filterContent(content).flagged) {
    return NextResponse.json({ error: 'التعليق يحتوي كلمات غير مناسبة — عدّله وأعد المحاولة' }, { status: 400 });
  }

  const row = await prisma.freeMediaComment.create({ data: { mediaId: id, userId: user.userId, content } });
  const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });
  return NextResponse.json({
    comment: {
      id: row.id, content: row.content, createdAt: row.createdAt.toISOString(),
      user: { id: user.userId, name: firstName(me?.name) },
    },
  });
}
