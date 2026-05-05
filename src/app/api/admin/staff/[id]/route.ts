export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin, PERMISSIONS, type Permission } from '@/lib/permissions';

// PUT /api/admin/staff/[id] — replace permissions for a staff user.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const perms = Array.isArray(body.permissions) ? body.permissions as string[] : [];
  const cleanPerms = perms.filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p));

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
  if (target.role === 'admin') return NextResponse.json({ error: 'لا يمكن تعديل صلاحيات الأدمن الرئيسي من هنا' }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id },
    data: { permissions: cleanPerms as unknown as object },
    select: { id: true, name: true, email: true, phone: true, role: true, permissions: true, createdAt: true },
  });
  return NextResponse.json({
    staff: { ...updated, permissions: (updated.permissions as unknown[] | null) ?? [] },
  });
}

// DELETE /api/admin/staff/[id] — revoke staff role (back to customer).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;
  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
  if (target.role === 'admin') return NextResponse.json({ error: 'لا يمكن إلغاء الأدمن الرئيسي' }, { status: 400 });

  await prisma.user.update({
    where: { id },
    data: { role: 'customer', permissions: [] as unknown as object },
  });
  return NextResponse.json({ ok: true });
}
