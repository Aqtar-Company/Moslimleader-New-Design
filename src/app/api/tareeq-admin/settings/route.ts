export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';

export async function GET(req: Request) {
  try {
    await requireAdmin(req, ['SUPER_ADMIN'] as never[]);
  } catch (e) {
    return e as Response;
  }

  try {
    const settings = await prisma.tareeqPlatformSetting.findMany({
      orderBy: { key: 'asc' },
    });
    return Response.json({ ok: true, settings });
  } catch (err) {
    console.error('[tareeq-admin/settings GET]', err);
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
    const { key, value } = body as { key: string; value: string };

    if (!key || value === undefined) {
      return Response.json({ error: 'key and value are required' }, { status: 400 });
    }

    const updated = await prisma.tareeqPlatformSetting.update({
      where: { key },
      data: {
        value: String(value),
        updatedBy: admin.id,
      },
    });

    await logAudit(admin.id, 'setting.update', {
      targetType: 'setting',
      targetId: key,
      details: { key, value },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return Response.json({ ok: true, setting: updated });
  } catch (err) {
    console.error('[tareeq-admin/settings PATCH]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
