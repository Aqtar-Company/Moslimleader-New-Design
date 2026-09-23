export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// GET /api/tareeq/notifications?countOnly=true&page=1&limit=20
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ unreadCount: 0, notifications: [] });

  const { searchParams } = new URL(req.url);
  const countOnly = searchParams.get('countOnly') === 'true';

  if (countOnly) {
    // Exclude message-type notifications — those count under the inbox badge, not the bell
    const unreadCount = await prisma.tareeqNotification.count({
      where: { userId: user.userId, read: false, type: { not: 'message' } },
    });
    return NextResponse.json({ unreadCount });
  }

  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')));

  const [notifications, unreadCount] = await Promise.all([
    prisma.tareeqNotification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.tareeqNotification.count({ where: { userId: user.userId, read: false, type: { not: 'message' } } }),
  ]);

  /**
   * The actor's picture, resolved from their row rather than read off the notification.
   *
   * `TareeqNotification.actorAvatarUrl` is a column on the model and a parameter of
   * `notifyTareeq()`, and NOTHING has ever passed it — so it is null on every row ever
   * written, and the list could only draw a generic icon. It was reported as "the photos
   * do not show in notifications".
   *
   * Filling the column going forward would leave every existing notification blank and
   * freeze a copy of the photo at the moment it was sent — a member who changes their
   * picture would keep the old one in everybody's history. This joins instead: one query
   * for the handful of distinct actors on the page, always current, and it repairs the
   * notifications already stored. The gender rides along because the veiling rule decides
   * whether the reader sees that picture softened.
   */
  const actorIds = [...new Set(notifications.map(n => n.actorId).filter((x): x is string => !!x))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, avatarUrl: true, tareeqGender: true },
      })
    : [];
  const byId = new Map(actors.map(a => [a.id, a]));

  const withActors = notifications.map(n => {
    const a = n.actorId ? byId.get(n.actorId) : null;
    return {
      ...n,
      // The stored copy stays as a fallback for a deleted account.
      actorAvatarUrl: a?.avatarUrl ?? n.actorAvatarUrl ?? null,
      actorName: a?.name ?? n.actorName ?? null,
      actorGender: a?.tareeqGender ?? null,
    };
  });

  return NextResponse.json({ notifications: withActors, unreadCount });
}

// POST /api/tareeq/notifications — mark read
// body: { ids?: string[] } — all if omitted
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = body.ids;

  await prisma.tareeqNotification.updateMany({
    where: {
      userId: user.userId,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
