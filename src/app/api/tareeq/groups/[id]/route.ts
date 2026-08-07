export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/tareeq/groups/[id] — group info + messages
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const member = await prisma.tareeqGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
  });
  if (!member) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const [group, messages] = await Promise.all([
    prisma.tareeqGroup.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        description: true,
        createdBy: true,
        members: {
          select: {
            role: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    }),
    prisma.tareeqGroupMessage.findMany({
      where: { groupId: params.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        content: true,
        imageUrl: true,
        videoUrl: true,
        createdAt: true,
        senderId: true,
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
  ]);

  if (!group) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  return NextResponse.json({ group, messages, myRole: member.role });
}

// PATCH /api/tareeq/groups/[id] — update group name/description (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const member = await prisma.tareeqGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
  });
  if (!member || member.role !== 'admin') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = body.name ? String(body.name).trim() : undefined;
  const description = body.description !== undefined ? (String(body.description).trim() || null) : undefined;

  if (name !== undefined && (name.length < 2 || name.length > 50)) {
    return NextResponse.json({ error: 'اسم غير صالح' }, { status: 400 });
  }

  const group = await prisma.tareeqGroup.update({
    where: { id: params.id },
    data: { ...(name && { name }), ...(description !== undefined && { description }) },
    select: { id: true, name: true, description: true },
  });

  return NextResponse.json({ ok: true, group });
}
