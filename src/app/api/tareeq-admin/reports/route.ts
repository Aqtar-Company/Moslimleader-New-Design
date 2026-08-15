export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

const ALLOWED = [TareeqAdminRole.SUPER_ADMIN, TareeqAdminRole.MODERATOR];
const VALID_STATUSES = ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'];

// GET /api/tareeq-admin/reports
// Params: status (PENDING|REVIEWED|RESOLVED|DISMISSED), page, limit=20
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request, ALLOWED);
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

  const [reports, total] = await Promise.all([
    prisma.tareeqReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        reporter: { select: { id: true, name: true } },
        // Always include all potential targets — only the relevant one will be non-null
        targetPost: {
          select: {
            id: true,
            content: true,
            isHidden: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
          },
        },
        targetComment: {
          select: {
            id: true,
            content: true,
            isHidden: true,
            createdAt: true,
            postId: true,
            user: { select: { id: true, name: true } },
          },
        },
        targetUser: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            tareeqSuspended: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.tareeqReport.count({ where }),
  ]);

  return Response.json({ ok: true, reports, total, pages: Math.ceil(total / limit) });
}
