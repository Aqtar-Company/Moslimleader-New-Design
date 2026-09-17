export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { NOTICE_SELECT } from '@/lib/admin-broadcast';

/**
 * The messages the administration has sent to THIS member — "الإعلانات والتحديثات".
 *
 * Membership of the list is the recipient row, not the notification: a member who switched
 * platform announcements off still received the message (it is in their recipient row,
 * they just were not interrupted about it), so it still shows here. That is what makes this
 * page the reliable place to find a notice you missed.
 */
// GET /api/tareeq/notices?cursor=<recipientId>&limit=20
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')));

  const rows = await prisma.adminBroadcastRecipient.findMany({
    where: {
      userId: user.userId,
      // A queued row is a message that has not reached this person yet — not theirs to see.
      status: { in: ['done', 'failed'] },
      broadcast: { status: { in: ['sending', 'sent', 'failed', 'canceled'] } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, readAt: true, createdAt: true, broadcast: { select: NOTICE_SELECT } },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const unreadCount = await prisma.adminBroadcastRecipient.count({
    where: { userId: user.userId, status: { in: ['done', 'failed'] }, readAt: null },
  });

  return NextResponse.json({
    notices: page.map(r => ({ ...r.broadcast, receivedAt: r.createdAt, readAt: r.readAt })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    unreadCount,
  });
}

// POST /api/tareeq/notices — mark every notice read (the list page's "تحديد الكل كمقروء").
export async function POST() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await Promise.all([
    prisma.adminBroadcastRecipient.updateMany({ where: { userId: user.userId, readAt: null }, data: { readAt: new Date() } }),
    prisma.tareeqNotification.updateMany({ where: { userId: user.userId, read: false, type: { startsWith: 'admin_' } }, data: { read: true } }),
  ]);
  return NextResponse.json({ ok: true });
}
