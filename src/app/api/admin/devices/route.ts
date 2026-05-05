export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// GET /api/admin/devices?userId=xxx — list devices for a user
// Super-admin only — touches another user's account state.
export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if ('response' in guard) return guard.response;

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const devices = await prisma.bookDevice.findMany({
    where: { userId },
    orderBy: { lastSeen: 'desc' },
  });

  return NextResponse.json({ devices });
}

// DELETE /api/admin/devices?userId=xxx — reset all devices for a user
export async function DELETE(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if ('response' in guard) return guard.response;
  const auth = guard.user;

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  await prisma.bookDevice.deleteMany({ where: { userId } });
  await prisma.bookSession.deleteMany({ where: { userId } });

  await logActionSafe({
    actor: auth,
    action: 'user.devices-reset',
    entity: 'User',
    entityId: userId,
  });

  return NextResponse.json({ ok: true, message: 'تم إعادة تعيين الأجهزة بنجاح' });
}
