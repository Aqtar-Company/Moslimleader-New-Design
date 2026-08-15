export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

// PATCH /api/tareeq-admin/reports/[id]
// Body: { status: 'RESOLVED' | 'DISMISSED', resolution? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let admin;
  try {
    admin = await requireAdmin(request, [TareeqAdminRole.SUPER_ADMIN, TareeqAdminRole.MODERATOR]);
  } catch (e) {
    return e as Response;
  }

  const body = await request.json().catch(() => ({}));
  const { status, resolution } = body as { status?: string; resolution?: string };

  if (!status || !['RESOLVED', 'DISMISSED'].includes(status)) {
    return Response.json({ error: 'status must be RESOLVED or DISMISSED' }, { status: 400 });
  }

  const existing = await prisma.tareeqReport.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: 'Report not found' }, { status: 404 });

  const report = await prisma.tareeqReport.update({
    where: { id: params.id },
    data: {
      status: status as 'RESOLVED' | 'DISMISSED',
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      resolution: resolution ?? null,
    },
  });

  await logAudit(admin.id, 'report.resolve', {
    targetType: 'report',
    targetId: params.id,
    details: { status, resolution },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return Response.json({ ok: true, report });
}
