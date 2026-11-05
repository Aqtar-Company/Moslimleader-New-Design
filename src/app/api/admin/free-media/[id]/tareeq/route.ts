export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { ensureDiscussionPost } from '@/lib/media-tareeq';

/**
 * POST { content? } — «انشر في طريق»: the item's official post, dated now. An item that
 * already has one (published before, or made by a member's first comment) keeps it: one
 * item, one conversation. Answers with the post id either way.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'معرف غير صالح' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === 'string' ? body.content : undefined;
  try {
    const r = await ensureDiscussionPost(id, { fresh: true, content });
    if (!r) return NextResponse.json({ error: 'انشر المادة في المكتبة أولاً' }, { status: 400 });
    return NextResponse.json({ postId: r.postId, created: r.created });
  } catch (err) {
    console.error('[admin free-media tareeq]', err);
    return NextResponse.json({ error: 'تعذّر النشر في طريق' }, { status: 500 });
  }
}
