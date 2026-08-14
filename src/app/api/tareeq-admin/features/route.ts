export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
  } catch (e) {
    return e as Response;
  }

  try {
    const features = await prisma.tareeqFeatureFlag.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return Response.json({ ok: true, features });
  } catch (err) {
    console.error('[tareeq-admin/features GET]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let admin;
  try {
    admin = await requireAdmin(req, ['SUPER_ADMIN'] as never[]);
  } catch (e) {
    return e as Response;
  }

  try {
    const body = await req.json();
    const { key, enabled } = body as { key: string; enabled: boolean };

    if (!key || typeof enabled !== 'boolean') {
      return Response.json({ error: 'key and enabled are required' }, { status: 400 });
    }

    const updated = await prisma.tareeqFeatureFlag.update({
      where: { key },
      data: {
        enabled,
        updatedBy: admin.id,
      },
    });

    await logAudit(admin.id, enabled ? 'feature.enable' : 'feature.disable', {
      targetType: 'feature',
      targetId: key,
      details: { key, enabled },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return Response.json({ ok: true, feature: updated });
  } catch (err) {
    console.error('[tareeq-admin/features PATCH]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
