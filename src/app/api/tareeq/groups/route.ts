export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/tareeq/groups — list groups the user belongs to
export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

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
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-create-group:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim() || null;
  const memberIds: string[] = Array.isArray(body.memberIds)
    ? body.memberIds.filter((id: unknown) => typeof id === 'string' && id !== user.userId).slice(0, 50)
    : [];

  if (!name || name.length < 2) return NextResponse.json({ error: 'اسم المجموعة مطلوب (حرفان على الأقل)' }, { status: 400 });
  if (name.length > 50) return NextResponse.json({ error: 'الاسم طويل جداً' }, { status: 400 });

  const group = await prisma.tareeqGroup.create({
    data: {
      name,
      description,
      createdBy: user.userId,
      members: {
        create: [
          { userId: user.userId, role: 'admin' },
          ...memberIds.map(id => ({ userId: id, role: 'member' as string })),
        ],
      },
    },
    select: { id: true, name: true, imageUrl: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, group });
}
