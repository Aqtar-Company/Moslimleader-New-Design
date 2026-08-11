export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
  } catch (e) {
    return e as Response;
  }

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

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
      prisma.user.count(),
      prisma.user.count({ where: { tareeqLastSeen: { gte: since24h } } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
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

    return Response.json({
      ok: true,
      stats: {
        users: {
          total: usersTotal,
          active24h: usersActive24h,
          newToday: usersNewToday,
          suspended: usersSuspended,
        },
        posts: {
          total: postsTotal,
          today: postsToday,
          hidden: postsHidden,
        },
        comments: {
          total: commentsTotal,
        },
        reports: {
          pending: reportsPending,
          total: reportsTotal,
        },
        calls: {
          total: callsTotal,
        },
        follows: {
          total: followsTotal,
        },
      },
    });
  } catch (err) {
    console.error('[tareeq-admin/stats]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
