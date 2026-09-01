export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit, isTareeqSuspended } from '@/lib/tareeq-guard';

// POST /api/tareeq/groups/[id]/join — self-join a public group.
// Previously there was no way to join a group at all except being invited by
// name at creation time — a stranger who found a group via discovery had no
// way to actually get in.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const rl = tareeqRateLimit('group-join', user.userId, 20, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  if (await isTareeqSuspended(user.userId)) {
    return NextResponse.json({ error: 'تم تعليق حسابك في طريق' }, { status: 403 });
  }

  const group = await prisma.tareeqGroup.findUnique({ where: { id: params.id }, select: { id: true, isPublic: true } });
  if (!group) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (!group.isPublic) return NextResponse.json({ error: 'هذه المجموعة خاصة — تحتاج دعوة للانضمام' }, { status: 403 });

  try {
    await prisma.tareeqGroupMember.create({
      data: { groupId: params.id, userId: user.userId, role: 'member' },
    });
  } catch (e: any) {
    // P2002 = already a member — idempotent, not an error
    if (e?.code !== 'P2002') throw e;
  }

  return NextResponse.json({ ok: true });
}
