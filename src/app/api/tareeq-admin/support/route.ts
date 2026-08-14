export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

// GET /api/tareeq-admin/support
// Params: status (OPEN|IN_PROGRESS|RESOLVED|CLOSED), page, limit=20
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (e) {
    return e as Response;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? '';
  const page   = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '20')));

  const where: Record<string, unknown> = {};
  if (status && VALID_STATUSES.includes(status)) {
    where.status = status;
  }

  const [tickets, total] = await Promise.all([
    prisma.tareeqSupportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.tareeqSupportTicket.count({ where }),
  ]);

  return Response.json({ ok: true, tickets, total, pages: Math.ceil(total / limit) });
}
