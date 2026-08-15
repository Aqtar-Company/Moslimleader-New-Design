export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

// GET /api/tareeq-admin/health
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request, [TareeqAdminRole.SUPER_ADMIN, TareeqAdminRole.SECURITY]);
  } catch (e) {
    return e as Response;
  }

  // Test database connectivity
  let database: 'ok' | 'error' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'error';
  }

  const [pushSubscriptions, activeCalls] = await Promise.allSettled([
    prisma.tareeqPushSubscription.count(),
    prisma.tareeqCall.count({
      where: { status: { in: ['ringing', 'active'] } },
    }),
  ]);

  const mem = process.memoryUsage();

  return Response.json({
    ok: true,
    database,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used:  mem.heapUsed,
      total: mem.heapTotal,
      rss:   mem.rss,
    },
    pushSubscriptions: pushSubscriptions.status === 'fulfilled' ? pushSubscriptions.value : 0,
    activeCalls:       activeCalls.status      === 'fulfilled' ? activeCalls.value       : 0,
  });
}
