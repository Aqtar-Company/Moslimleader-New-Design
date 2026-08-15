export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin(req, [TareeqAdminRole.SUPER_ADMIN]);
  } catch (e) {
    return e as Response;
  }

  try {
    // Cannot deactivate self
    if (params.id === admin.id) {
      return Response.json({ error: 'Cannot modify your own account' }, { status: 400 });
    }

    const body = await req.json();
    const { isActive } = body as { isActive: boolean };

    if (typeof isActive !== 'boolean') {
      return Response.json({ error: 'isActive (boolean) is required' }, { status: 400 });
    }

    const target = await prisma.tareeqAdmin.findUnique({ where: { id: params.id } });
    if (!target) {
      return Response.json({ error: 'Admin not found' }, { status: 404 });
    }

    const updated = await prisma.tareeqAdmin.update({
      where: { id: params.id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await logAudit(admin.id, isActive ? 'admin.activate' : 'admin.deactivate', {
      targetType: 'admin',
      targetId: params.id,
      details: { isActive },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return Response.json({ ok: true, admin: updated });
  } catch (err) {
    console.error('[tareeq-admin/roles/[id] PATCH]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
