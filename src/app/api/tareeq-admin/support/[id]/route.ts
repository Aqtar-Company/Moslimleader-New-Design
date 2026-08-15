export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';

// GET /api/tareeq-admin/support/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin(request);
  } catch (e) {
    return e as Response;
  }

  const ticket = await prisma.tareeqSupportTicket.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

  return Response.json({ ok: true, ticket });
}

// PATCH /api/tareeq-admin/support/[id]
// Body: { status?, assignedTo?, resolution?, notes? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (e) {
    return e as Response;
  }

  const existing = await prisma.tareeqSupportTicket.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: 'Ticket not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { status, assignedTo, resolution, notes } = body as {
    status?:     string;
    assignedTo?: string;
    resolution?: string;
    notes?:      string;
  };

  const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (status && !VALID_STATUSES.includes(status)) {
    return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (status     !== undefined) data.status     = status;
  if (assignedTo !== undefined) data.assignedTo = assignedTo;
  if (resolution !== undefined) data.resolution = resolution;
  if (notes      !== undefined) data.notes      = notes;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const ticket = await prisma.tareeqSupportTicket.update({
    where: { id: params.id },
    data,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit(admin.id, 'support.update', {
    targetType: 'ticket',
    targetId: params.id,
    details: { ...data },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return Response.json({ ok: true, ticket });
}
