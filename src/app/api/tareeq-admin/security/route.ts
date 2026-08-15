export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

// GET /api/tareeq-admin/security
// Returns: suspendedUsers, activeBans, recentBans, recentReports (pending), activeSessions
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request, [TareeqAdminRole.SUPER_ADMIN, TareeqAdminRole.SECURITY]);
  } catch (e) {
    return e as Response;
  }

  const now = new Date();

  const [
    suspendedUsers,
    activeBans,
    recentBans,
    recentReports,
    activeSessions,
  ] = await Promise.all([
    prisma.user.count({ where: { tareeqSuspended: true } }),
    prisma.tareeqBan.count({ where: { isActive: true } }),
    prisma.tareeqBan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.tareeqReport.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { reporter: { select: { id: true, name: true } } },
    }),
    prisma.tareeqAdminSession.count({ where: { expiresAt: { gt: now } } }),
  ]);

  return Response.json({
    ok: true,
    suspendedUsers,
    activeBans,
    recentBans,
    recentReports,
    activeSessions,
  });
}
