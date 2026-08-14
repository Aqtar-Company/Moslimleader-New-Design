export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';

export async function GET(req: Request) {
  try {
    await requireAdmin(req, ['SUPER_ADMIN', 'SECURITY'] as never[]);
  } catch (e) {
    return e as Response;
  }

  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '25', 10)));
    const action = url.searchParams.get('action') ?? '';

    const where: Record<string, unknown> = {};
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.tareeqAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          admin: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.tareeqAuditLog.count({ where }),
    ]);

    // Get distinct actions for filter dropdown
    const actions = await prisma.tareeqAuditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });

    return Response.json({
      ok: true,
      logs,
      total,
      pages: Math.ceil(total / limit),
      actions: actions.map((a) => a.action),
    });
  } catch (err) {
    console.error('[tareeq-admin/audit]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
