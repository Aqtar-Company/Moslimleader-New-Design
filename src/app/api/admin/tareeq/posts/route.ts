export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const hidden = url.searchParams.get('hidden');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = 20;

  const where: Record<string, unknown> = {};
  if (q.trim()) where.content = { contains: q.trim() };
  if (hidden === 'true') where.isHidden = true;
  else if (hidden === 'false') where.isHidden = false;

  const [total, posts] = await Promise.all([
    prisma.tareeqPost.count({ where }),
    prisma.tareeqPost.findMany({
      where,
      select: {
        id: true, content: true, authorName: true, category: true,
        isHidden: true, hiddenReason: true, likeCount: true,
        commentCount: true, viewCount: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { reports: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ posts, total, page, limit });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, isHidden, hiddenReason } = await req.json().catch(() => ({}));
  if (!id || typeof isHidden !== 'boolean') return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const post = await prisma.tareeqPost.update({
    where: { id },
    data: {
      isHidden,
      hiddenBy: isHidden ? admin.userId : null,
      hiddenReason: isHidden ? (hiddenReason ?? 'مخالف للسياسات') : null,
    },
    select: { id: true, isHidden: true },
  });

  return NextResponse.json({ post });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.tareeqPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
