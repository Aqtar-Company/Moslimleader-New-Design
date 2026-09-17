export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

/**
 * The one notice the top banner may show: the newest UNREAD announcement or update this
 * member received in the last 7 days. Reminders and notes never take the banner — they are
 * for the bell, not for interrupting every page. Signed-out visitors get nothing.
 */
export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ notice: null });

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const row = await prisma.adminBroadcastRecipient.findFirst({
    where: {
      userId: user.userId,
      readAt: null,
      status: { in: ['done', 'failed'] },
      createdAt: { gte: since },
      broadcast: { kind: { in: ['announcement', 'update'] }, status: { in: ['sending', 'sent'] } },
    },
    orderBy: { createdAt: 'desc' },
    select: { broadcast: { select: { id: true, kind: true, title: true } } },
  });
  return NextResponse.json({ notice: row?.broadcast ?? null });
}
