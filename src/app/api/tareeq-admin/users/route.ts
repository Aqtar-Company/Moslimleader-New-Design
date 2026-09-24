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
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
    const status = url.searchParams.get('status') ?? 'all'; // all | suspended | active
    const scope = url.searchParams.get('scope') ?? 'tareeq'; // tareeq | all

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = scope === 'tareeq' ? { tareeqLastSeen: { not: null } } : {};

    if (q.trim()) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
      ];
    }

    if (status === 'suspended') {
      where.tareeqSuspended = true;
    } else if (status === 'active') {
      where.tareeqSuspended = false;
    }

    // ── The counts strip ──────────────────────────────────────────────────────────────
    //
    // Independent of the search box, the status tab and the page: the screen used to show
    // no number at all — `total` was fetched and only `pages` was read from it — so "how
    // many people are on طريق" had no answer anywhere in the panel, and the row count on
    // screen answered a different question (this page of this filter).
    //
    // Two numbers, because "actual users" has two honest readings and they are far apart:
    // `tareeq` is everyone who has opened طريق, and `contributors` is everyone who has
    // written something in it. Reporting only the first overstates the place; reporting
    // only the second understates it.
    //
    // `shopOnly` is the rest of the User table, and it is mostly not a mailing list or a
    // membership: 96% of rows are phone-import rows for manual orders. It is here so a
    // reader does not mistake the table's own row count for طريق's size.
    const now = Date.now();
    const since = (days: number) => new Date(now - days * 86_400_000);
    const inTareeq = { tareeqLastSeen: { not: null } } as const;

    const [users, total, tareeqCount, active7, active30, contributors, shopOnly, suspended] = await Promise.all([

      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          tareeqLastSeen: true,
          tareeqSuspended: true,
          tareeqSuspendedAt: true,
          tareeqSuspendReason: true,
          createdAt: true,
          _count: {
            select: {
              tareeqPosts: true,
              tareeqComments: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: inTareeq }),
      prisma.user.count({ where: { tareeqLastSeen: { gte: since(7) } } }),
      prisma.user.count({ where: { tareeqLastSeen: { gte: since(30) } } }),
      prisma.user.count({ where: { OR: [{ tareeqPosts: { some: {} } }, { tareeqComments: { some: {} } }] } }),
      prisma.user.count({ where: { tareeqLastSeen: null } }),
      prisma.user.count({ where: { ...inTareeq, tareeqSuspended: true } }),
    ]);

    return Response.json({
      ok: true,
      users,
      total,
      pages: Math.ceil(total / limit),
      counts: { tareeq: tareeqCount, active7, active30, contributors, shopOnly, suspended },
    });
  } catch (err) {
    console.error('[tareeq-admin/users]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
