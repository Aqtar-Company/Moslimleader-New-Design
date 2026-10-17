export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';

/**
 * «إخفاء هذا المنشور» — take ONE post out of the viewer's feeds.
 *
 * The finer-grained sibling of muting a person. It reuses `TareeqMute`, whose `postId`
 * column (with its own `@@unique([muterId, postId])`) was in the schema from the start
 * and never written. The feed route excludes these ids from every list except the
 * author's own page; the post's link still opens it.
 */
export async function POST(_req: NextRequest, { params }: { params: { postId: string } }) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await tareeqRateLimit('hide-post', me.userId, 120, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const post = await prisma.tareeqPost.findUnique({ where: { id: params.postId }, select: { id: true, userId: true } });
  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (post.userId === me.userId) return NextResponse.json({ error: 'لا يمكن إخفاء منشورك' }, { status: 400 });

  try {
    await prisma.tareeqMute.create({ data: { muterId: me.userId, postId: post.id } });
  } catch (e: unknown) {
    // Already hidden: idempotent, a double tap must not fail.
    if ((e as { code?: string })?.code !== 'P2002') throw e;
  }
  return NextResponse.json({ hidden: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { postId: string } }) {
  const me = await getAuthUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await prisma.tareeqMute.deleteMany({ where: { muterId: me.userId, postId: params.postId } });
  return NextResponse.json({ hidden: false });
}
