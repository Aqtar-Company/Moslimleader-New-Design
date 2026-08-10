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

  return NextResponse.json({ notifications, unreadCount });
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
