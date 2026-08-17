export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

const MEMBER_SELECT = {
  id: true,
  streak: true,
  lastReadDate: true,
  totalPages: true,
  points: true,
  joinedAt: true,
  user: { select: { id: true, name: true, avatarUrl: true } },
};

/** GET — group details + leaderboard (any member can view) */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const group = await prisma.khatmaGroup.findUnique({
    where: { id: params.id },
    include: {
      admin: { select: { id: true, name: true, avatarUrl: true } },
      members: { select: MEMBER_SELECT, orderBy: { points: 'desc' } },
    },
  });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isMember = group.members.some(m => m.user.id === user.userId);
  if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  return NextResponse.json({ group });
}

/** DELETE — admin can delete the group */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const group = await prisma.khatmaGroup.findUnique({ where: { id: params.id }, select: { adminId: true } });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (group.adminId !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.khatmaGroup.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
