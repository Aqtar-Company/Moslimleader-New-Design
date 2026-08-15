export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';

// 30-second in-memory cache so rapid page navigations don't hammer the DB
let cachedStats: ReturnType<typeof buildResponse> | null = null;
let cacheExpiry = 0;

function buildResponse(data: {
  usersTotal: number; usersActive24h: number; usersNewToday: number; usersSuspended: number;
  postsTotal: number; postsToday: number; postsHidden: number;
  commentsTotal: number; reportsPending: number; reportsTotal: number;
  callsTotal: number; followsTotal: number;
}) {
  return {
    ok: true,
    stats: {
      users: {
        total: data.usersTotal,
        active24h: data.usersActive24h,
        newToday: data.usersNewToday,
        suspended: data.usersSuspended,
      },
      posts:    { total: data.postsTotal, today: data.postsToday, hidden: data.postsHidden },
      comments: { total: data.commentsTotal },
      reports:  { pending: data.reportsPending, total: data.reportsTotal },
      calls:    { total: data.callsTotal },
      follows:  { total: data.followsTotal },
    },
  };
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
  } catch (e) {
    return e as Response;
  }

  // Serve cache if fresh
  if (cachedStats && Date.now() < cacheExpiry) {
    return Response.json(cachedStats);
  }

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Only count users who have actually used Tareeq (tareeqLastSeen set)
    const tareeqUserWhere = { tareeqLastSeen: { not: null } } as const;

    const [
      usersTotal,
      usersActive24h,
      usersNewToday,
      usersSuspended,
      postsTotal,
      postsToday,
      postsHidden,
      commentsTotal,
      reportsPending,
      reportsTotal,
      callsTotal,
      followsTotal,
    ] = await Promise.all([
      prisma.user.count({ where: tareeqUserWhere }),
      prisma.user.count({ where: { tareeqLastSeen: { gte: since24h } } }),
      prisma.user.count({ where: { ...tareeqUserWhere, createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { tareeqSuspended: true } }),
      prisma.tareeqPost.count(),
      prisma.tareeqPost.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.tareeqPost.count({ where: { isHidden: true } }),
      prisma.tareeqComment.count(),
      prisma.tareeqReport.count({ where: { status: 'PENDING' } }),
      prisma.tareeqReport.count(),
      prisma.tareeqCall.count(),
      prisma.tareeqFollow.count(),
    ]);

    const result = buildResponse({
      usersTotal, usersActive24h, usersNewToday, usersSuspended,
      postsTotal, postsToday, postsHidden,
      commentsTotal, reportsPending, reportsTotal,
      callsTotal, followsTotal,
    });

    cachedStats = result;
    cacheExpiry = Date.now() + 30_000;

    return Response.json(result);
  } catch (err) {
    console.error('[tareeq-admin/stats]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
