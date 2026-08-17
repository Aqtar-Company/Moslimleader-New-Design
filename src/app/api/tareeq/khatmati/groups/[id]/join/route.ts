export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

/** POST /api/tareeq/khatmati/groups/[id]/join
 *  Body: { inviteCode: string }
 *  Joins the caller as a member (idempotent — safe to call again if already member).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { inviteCode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const group = await prisma.khatmaGroup.findUnique({
    where: { id: params.id },
    select: { id: true, inviteCode: true, isActive: true },
  });

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  if (!group.isActive) return NextResponse.json({ error: 'Group is closed' }, { status: 410 });
  if (group.inviteCode !== body.inviteCode) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 });
  }

  // Idempotent upsert — already a member is fine
  await prisma.khatmaGroupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.userId } },
    update: {},
    create: { groupId: group.id, userId: user.userId },
  });

  return NextResponse.json({ ok: true });
}
