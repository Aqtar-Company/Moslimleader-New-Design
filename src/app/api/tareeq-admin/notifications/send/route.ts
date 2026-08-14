export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logAudit } from '@/lib/tareeq-admin-auth';
import { sendPushToUser } from '@/lib/tareeq-push';

// POST /api/tareeq-admin/notifications/send
// Body: { title, body, url?, targetType: 'all' | 'user', userId? }
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (e) {
    return e as Response;
  }

  const body = await request.json().catch(() => ({}));
  const {
    title,
    body: msgBody,
    url = '/tareeq',
    targetType,
    userId,
  } = body as {
    title?: string;
    body?: string;
    url?: string;
    targetType?: 'all' | 'user';
    userId?: string;
  };

  if (!title || !msgBody) {
    return Response.json({ error: 'title and body are required' }, { status: 400 });
  }
  if (!targetType || !['all', 'user'].includes(targetType)) {
    return Response.json({ error: 'targetType must be all or user' }, { status: 400 });
  }
  if (targetType === 'user' && !userId) {
    return Response.json({ error: 'userId is required when targetType is user' }, { status: 400 });
  }

  const payload = { title, body: msgBody, url, type: 'generic' as const };

  let sent = 0;
  let failed = 0;

  if (targetType === 'user' && userId) {
    // Send to a specific user via the existing push helper
    await sendPushToUser(userId, payload).catch(() => { failed++; });
    sent = 1;
  } else {
    // Send to all users who have push subscriptions
    const distinctUsers = await prisma.tareeqPushSubscription.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });

    const results = await Promise.allSettled(
      distinctUsers.map(({ userId: uid }) => sendPushToUser(uid, payload)),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') sent++;
      else failed++;
    }
  }

  await logAudit(admin.id, 'notifications.send', {
    targetType: targetType === 'user' ? 'user' : 'broadcast',
    targetId: userId ?? 'all',
    details: { title, body: msgBody, url, targetType, userId, sent, failed },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return Response.json({ ok: true, sent, failed });
}
