export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin, PERMISSIONS, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// GET /api/admin/staff — list current staff (role='staff') + super-admins.
export async function GET() {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;

  const users = await prisma.user.findMany({
    where: { role: { in: ['admin', 'staff'] } },
    select: {
      id: true, name: true, email: true, phone: true,
      role: true, permissions: true, createdAt: true, lastLoginAt: true,
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({
    staff: users.map(u => ({
      ...u,
      permissions: (u.permissions as unknown[] | null) ?? [],
    })),
  });
}

// POST /api/admin/staff — promote an existing customer to staff with
// initial permissions. Body: { email, permissions: string[] }.
// We promote-by-email so we don't accidentally create new accounts.
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const perms = Array.isArray(body.permissions) ? body.permissions as string[] : [];
  if (!email) return NextResponse.json({ error: 'الإيميل مطلوب' }, { status: 400 });

  const cleanPerms = perms.filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p));

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return NextResponse.json({ error: 'مفيش حساب بهذا الإيميل — لازم يسجّل عضوية أولاً' }, { status: 404 });
  if (target.role === 'admin') return NextResponse.json({ error: 'هذا الحساب أدمن رئيسي بالفعل' }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      role: 'staff',
      permissions: cleanPerms as unknown as object,
    },
    select: { id: true, name: true, email: true, phone: true, role: true, permissions: true, createdAt: true },
  });

  await logActionSafe({
    actor: auth.user,
    action: 'staff.add',
    entity: 'User',
    entityId: updated.id,
    after: { email: updated.email, name: updated.name, permissions: cleanPerms },
  });

  return NextResponse.json({
    staff: { ...updated, permissions: (updated.permissions as unknown[] | null) ?? [] },
  });
}
