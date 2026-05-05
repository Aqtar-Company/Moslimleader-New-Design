export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { actionLabel } from '@/lib/audit-log';

// GET /api/admin/audit-log — recent admin/staff write actions.
// Super-admin only — staff have no business reading other staff's history.
export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if ('response' in guard) return guard.response;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 500);
  const actorUserId = url.searchParams.get('actorUserId') || undefined;
  const action = url.searchParams.get('action') || undefined;

  const rows = await prisma.auditLog.findMany({
    where: {
      ...(actorUserId ? { actorUserId } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    entries: rows.map(r => ({
      id: r.id,
      actor: {
        id: r.actorUserId,
        role: r.actorRole,
        name: r.actorName,
        email: r.actorEmail,
      },
      action: r.action,
      actionLabel: actionLabel(r.action),
      entity: r.entity,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      metadata: r.metadata,
      createdAt: r.createdAt,
    })),
  });
}
