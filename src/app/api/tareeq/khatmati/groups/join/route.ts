export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

/** POST /api/tareeq/khatmati/groups/join
 *  Body: { inviteCode: string }
 *  Looks up the group by inviteCode then joins the caller as a member.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { inviteCode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const code = String(body.inviteCode ?? '').trim();
  if (!code) return NextResponse.json({ error: 'inviteCode required' }, { status: 400 });

  const group = await prisma.khatmaGroup.findUnique({
    where: { inviteCode: code },
    select: { id: true, isActive: true },
  });

  if (!group) return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  if (!group.isActive) return NextResponse.json({ error: 'Group is closed' }, { status: 410 });

  await prisma.khatmaGroupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.userId } },
    update: {},
    create: { groupId: group.id, userId: user.userId },
  });

  return NextResponse.json({ groupId: group.id });
}
