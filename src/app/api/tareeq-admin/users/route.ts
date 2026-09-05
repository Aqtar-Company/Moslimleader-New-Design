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

    const [users, total] = await Promise.all([
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
    ]);

    return Response.json({
      ok: true,
      users,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[tareeq-admin/users]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
