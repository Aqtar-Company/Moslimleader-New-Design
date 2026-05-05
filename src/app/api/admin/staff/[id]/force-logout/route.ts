export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// POST /api/admin/staff/[id]/force-logout — bump tokenVersion without
// touching role/permissions. Use this when a staff laptop is lost: their
// JWT becomes invalid on the next request and they must re-sign-in. Their
// permissions stay intact so they can keep working from a new device.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
  if (target.id === guard.user.userId) {
    return NextResponse.json({ error: 'لا يمكنك تسجيل خروج نفسك من هنا' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  });

  await logActionSafe({
    actor: guard.user,
    action: 'staff.force-logout',
    entity: 'User',
    entityId: id,
    metadata: { email: target.email, role: target.role },
  });

  return NextResponse.json({ ok: true });
}
