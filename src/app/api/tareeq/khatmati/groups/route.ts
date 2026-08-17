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

/** GET  — list groups the current user belongs to or admins */
export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memberships = await prisma.khatmaGroupMember.findMany({
    where: { userId: user.userId },
    include: {
      group: {
        include: {
          admin: { select: { id: true, name: true, avatarUrl: true } },
          members: { select: MEMBER_SELECT, orderBy: { points: 'desc' } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const groups = memberships.map(m => ({
    ...m.group,
    myMembership: { streak: m.streak, totalPages: m.totalPages, points: m.points, lastReadDate: m.lastReadDate },
  }));

  return NextResponse.json({ groups });
}

/** POST — create a new group (caller is auto-joined as admin + member) */
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: string; description?: string; dailyGoal?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const name = String(body.name ?? '').trim().slice(0, 100);
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const dailyGoal = Math.max(1, Math.min(20, Number(body.dailyGoal ?? 4)));

  const group = await prisma.khatmaGroup.create({
    data: {
      name,
      description: body.description ? String(body.description).trim().slice(0, 500) : null,
      adminId: user.userId,
      dailyGoal,
      members: {
        create: { userId: user.userId },
      },
    },
    include: {
      admin: { select: { id: true, name: true, avatarUrl: true } },
      members: { select: MEMBER_SELECT },
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}
