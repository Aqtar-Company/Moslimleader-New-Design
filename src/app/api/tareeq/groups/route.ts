export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended } from '@/lib/tareeq-guard';

// GET /api/tareeq/groups — list groups the user belongs to
// GET /api/tareeq/groups?discover=true — public groups the user can join
// (there was previously no way for a stranger to find or join any group —
// membership only came from being invited by name at creation time)
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const discover = req.nextUrl.searchParams.get('discover') === 'true';

  if (discover) {
    const publicGroups = await prisma.tareeqGroup.findMany({
      where: {
        isPublic: true,
        members: { none: { userId: user.userId } },
      },
      select: {
        id: true, name: true, description: true, imageUrl: true, createdAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({
      groups: publicGroups.map(g => ({
        id: g.id, name: g.name, description: g.description, imageUrl: g.imageUrl,
        memberCount: g._count.members, createdAt: g.createdAt,
      })),
    });
  }

  const memberships = await prisma.tareeqGroupMember.findMany({
    where: { userId: user.userId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          lastMessage: true,
          lastMessageAt: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { group: { lastMessageAt: 'desc' } },
  });

  const groups = memberships.map(m => ({
    id: m.group.id,
    name: m.group.name,
    imageUrl: m.group.imageUrl,
    lastMessage: m.group.lastMessage,
    lastMessageAt: m.group.lastMessageAt,
    memberCount: m.group._count.members,
    role: m.role,
  }));

  return NextResponse.json({ groups });
}

// POST /api/tareeq/groups — create a group
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const rl = tareeqRateLimit('create-group', user.userId, 5, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(user.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim() || null;
  const isPublic = body.isPublic === true;
  const memberIds: string[] = Array.isArray(body.memberIds)
    ? body.memberIds.filter((id: unknown) => typeof id === 'string' && id !== user.userId).slice(0, 50)
    : [];

  if (!name || name.length < 2) return NextResponse.json({ error: 'اسم المجموعة مطلوب (حرفان على الأقل)' }, { status: 400 });
  if (name.length > 50) return NextResponse.json({ error: 'الاسم طويل جداً' }, { status: 400 });

  const group = await prisma.tareeqGroup.create({
    data: {
      name,
      description,
      isPublic,
      createdBy: user.userId,
      members: {
        create: [
          { userId: user.userId, role: 'admin' },
          ...memberIds.map(id => ({ userId: id, role: 'member' as string })),
        ],
      },
    },
    select: { id: true, name: true, imageUrl: true, isPublic: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, group });
}
