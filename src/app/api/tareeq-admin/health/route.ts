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
    // Web push fails SILENTLY without these: sendPushToUser() returns immediately when the
    // server keys are missing, and the client refuses to subscribe at all without the
    // public one. Nothing logs it, so a whole platform with no background notifications
    // looks exactly like a platform where nobody enabled them. Booleans only — never the
    // key values, and never the private key in any form.
    push: {
      serverKeys: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      clientKey: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      // A keysMatch BOOLEAN was green in the exact case it existed to catch: add the key to
      // .env, restart without rebuilding, and this route reads the runtime value while the
      // browser bundle — where NEXT_PUBLIC_* is inlined at BUILD time — still has none.
      // Prefixes instead, so the operator compares what the server signs with against what
      // the browser actually subscribed with (read it in DevTools, or from the sidebar).
      // Safe to expose: the VAPID public key is public by design. The private one is never
      // touched here.
      serverKeyPrefix: (process.env.VAPID_PUBLIC_KEY ?? '').slice(0, 10) || null,
      clientKeyPrefix: (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').slice(0, 10) || null,
      keysMatch: !!process.env.VAPID_PUBLIC_KEY
        && process.env.VAPID_PUBLIC_KEY === process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    },
  });
}
