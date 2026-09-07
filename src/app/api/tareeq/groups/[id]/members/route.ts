export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// POST — add member (admin only)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const admin = await prisma.tareeqGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
  });
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? '').trim();
  if (!userId) return NextResponse.json({ error: 'userId مطلوب' }, { status: 400 });

  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!targetUser) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });

  await prisma.tareeqGroupMember.upsert({
    where: { groupId_userId: { groupId: params.id, userId } },
    create: { groupId: params.id, userId, role: 'member' },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

// DELETE — leave group (or admin removes member)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetUserId: string = String(body.userId ?? user.userId).trim();

  const myMembership = await prisma.tareeqGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: user.userId } },
  });
  if (!myMembership) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // Can only remove others if admin
  if (targetUserId !== user.userId && myMembership.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  // Refuse to leave a group with no admin behind. The UI already blocks this (an admin is
  // offered "delete group" instead of "leave"), but a direct API call could orphan a group
  // permanently: only the creator is ever given the admin role — POST adds everyone as
  // 'member' — so there is no promote-to-admin flow to recover with.
  const targetMembership = await prisma.tareeqGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: targetUserId } },
    select: { role: true },
  });
  if (!targetMembership) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (targetMembership.role === 'admin') {
    const [adminCount, memberCount] = await Promise.all([
      prisma.tareeqGroupMember.count({ where: { groupId: params.id, role: 'admin' } }),
      prisma.tareeqGroupMember.count({ where: { groupId: params.id } }),
    ]);
    if (adminCount <= 1 && memberCount > 1) {
      return NextResponse.json(
        { error: 'عيّن مشرفاً آخر قبل المغادرة' },
        { status: 409 },
      );
    }
  }

  await prisma.tareeqGroupMember.delete({
    where: { groupId_userId: { groupId: params.id, userId: targetUserId } },
  });

  return NextResponse.json({ ok: true });
}
