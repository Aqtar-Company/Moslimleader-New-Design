export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { NOTICE_SELECT } from '@/lib/admin-broadcast';

/**
 * One notice, for a member who received it (or an admin previewing it).
 *
 * Opening it marks it read in BOTH places that track that: the recipient row (drives the
 * notices list and the banner) and the in-app notification rows whose `postId` is this
 * broadcast (drives the bell badge). One tap clears everything about this message.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [broadcast, receipt] = await Promise.all([
    prisma.adminBroadcast.findUnique({ where: { id: params.id }, select: { ...NOTICE_SELECT, status: true } }),
    prisma.adminBroadcastRecipient.findUnique({
      where: { broadcastId_userId: { broadcastId: params.id, userId: user.userId } },
      select: { id: true, readAt: true, status: true },
    }),
  ]);
  if (!broadcast) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });

  // Drafts are visible to nobody but the admin; a member sees a notice only if it was
  // addressed to them. The test send writes no recipient row, so the admin path covers it.
  const isAdmin = user.role === 'admin';
  const delivered = receipt && receipt.status !== 'queued';
  if (!isAdmin && (!delivered || broadcast.status === 'draft')) {
    return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
  }

  if (receipt && !receipt.readAt && delivered) {
    await Promise.all([
      prisma.adminBroadcastRecipient.update({ where: { id: receipt.id }, data: { readAt: new Date() } }),
      prisma.tareeqNotification.updateMany({
        where: { userId: user.userId, postId: params.id, read: false, type: { startsWith: 'admin_' } },
        data: { read: true },
      }),
    ]);
  }

  const { status: _status, ...notice } = broadcast;
  return NextResponse.json({ notice: { ...notice, readAt: receipt?.readAt ?? new Date() } });
}

// POST /api/tareeq/notices/[id] — mark read WITHOUT opening (the banner's dismiss).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await Promise.all([
    prisma.adminBroadcastRecipient.updateMany({
      where: { broadcastId: params.id, userId: user.userId, readAt: null },
      data: { readAt: new Date() },
    }),
    prisma.tareeqNotification.updateMany({
      where: { userId: user.userId, postId: params.id, read: false, type: { startsWith: 'admin_' } },
      data: { read: true },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
