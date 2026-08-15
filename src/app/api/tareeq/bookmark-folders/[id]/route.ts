import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'اسم التصنيف مطلوب' }, { status: 400 });
  }

  const folder = await prisma.tareeqBookmarkFolder.findFirst({
    where: { id: params.id, userId: user.userId },
  });
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.tareeqBookmarkFolder.update({
    where: { id: params.id },
    data: { name: name.trim() },
    include: { _count: { select: { bookmarks: true } } },
  });

  return NextResponse.json({ folder: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const folder = await prisma.tareeqBookmarkFolder.findFirst({
    where: { id: params.id, userId: user.userId },
  });
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Bookmarks in this folder will have folderId → null (SetNull cascade)
  await prisma.tareeqBookmarkFolder.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
